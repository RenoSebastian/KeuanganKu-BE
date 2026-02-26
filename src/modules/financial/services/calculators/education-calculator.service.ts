import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { MarketSettingsService } from '../../../master-data/services/market-settings.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { FinancialQuotaService } from '../core/financial-quota.service';
import { SimulationTokenService } from '../core/simulation-token.service';
import { CreateEducationPlanDto } from '../../dto/create-education.dto';
import { CreateEducationSimulationDto } from '../../dto/create-education-simulation.dto';
import { calculateEducationPlan } from '../../utils/financial-math.util';
import { User, HealthStatus, Prisma, SchoolLevel } from '@prisma/client';

@Injectable()
export class EducationCalculatorService {
    private readonly logger = new Logger(EducationCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly marketSettingsService: MarketSettingsService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    /**
     * [USER] Hitung & Simpan Rencana Pendidikan (Multi-Stage)
     */
    async calculateAndSaveEducation(userId: string, dto: CreateEducationPlanDto) {
        // 1. Ambil Dynamic Market Rates
        const marketRates = await this.marketSettingsService.getCurrentSettings();
        const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
        const returnRate = dto.returnRate ?? 12; // Asumsi return agresif (Equity) untuk pendidikan jangka panjang

        // 2. Kalkulasi Core
        const result = calculateEducationPlan({
            ...dto,
            inflationRate,
            returnRate,
        });

        // 3. Simpan ke Database (Atomic Transaction)
        const savedData = await this.prisma.$transaction(async (tx) => {
            // A. Simpan Header Plan
            const plan = await tx.educationPlan.create({
                data: {
                    userId,
                    childName: dto.childName,
                    childDob: new Date(dto.childDob),
                    inflationRate,
                    returnRate,
                    method: dto.method,
                },
            });

            // B. Siapkan Data Stages (TK, SD, SMP, dll)
            const stagesData = result.stagesBreakdown.map((stage) => {
                let dbLevel: SchoolLevel = stage.level;
                // Normalisasi Enum jika perlu
                const levelCheck = String(stage.level).toUpperCase();
                if (levelCheck === 'KULIAH' || levelCheck === 'PT') {
                    dbLevel = SchoolLevel.S1;
                }

                return {
                    planId: plan.id,
                    level: dbLevel,
                    costType: stage.costType,
                    currentCost: stage.currentCost,
                    yearsToStart: stage.yearsToStart,
                    futureCost: stage.futureCost,
                    monthlySaving: stage.monthlySaving,
                };
            });

            // C. Simpan Detail Stages
            await tx.educationStage.createMany({ data: stagesData });

            return plan;
        });

        return { plan: savedData, calculation: result };
    }

    /**
     * [USER] Ambil List Rencana Pendidikan
     */
    async getEducationPlans(userId: string) {
        const plans = await this.prisma.educationPlan.findMany({
            where: { userId },
            include: { stages: true },
            orderBy: { createdAt: 'desc' },
        });

        return plans.map((p) => {
            const { stages, ...planData } = p;
            // Rekalkulasi total on-the-fly untuk display
            const totalFutureCost = stages.reduce(
                (acc, s) => acc + Number(s.futureCost),
                0,
            );
            const totalMonthlySaving = stages.reduce(
                (acc, s) => acc + Number(s.monthlySaving),
                0,
            );
            return {
                plan: planData,
                calculation: {
                    totalFutureCost,
                    monthlySaving: totalMonthlySaving,
                    stagesBreakdown: stages,
                },
            };
        });
    }

    /**
     * [USER] Hapus Rencana Pendidikan
     */
    async deleteEducationPlan(userId: string, planId: string) {
        const plan = await this.prisma.educationPlan.findFirst({
            where: { id: planId, userId },
        });

        if (!plan) {
            throw new NotFoundException('Rencana pendidikan tidak ditemukan');
        }

        return this.prisma.educationPlan.delete({ where: { id: planId } });
    }

    /**
     * [AGENT] Simulasi Pendidikan (PDF + Token + Log)
     */
    async simulateAgentEducation(user: User, dto: CreateEducationSimulationDto) {
        // 1. Validasi Quota
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Kalkulasi Aggregat (Grand Total)
            let grandTotalFutureCost = 0;
            let grandTotalMonthlySaving = 0;

            // Note: Logic kalkulasi per-anak diasumsikan sudah dilakukan di Frontend 
            // atau DTO mengirim data yang sudah dihitung (calculatedFutureValue).
            // Jika Backend perlu menghitung ulang, kita harus loop call `calculateEducationPlan`
            // Untuk saat ini kita ikuti pola existing: Agregasi dari input DTO.

            if (dto.childrenPlans) {
                dto.childrenPlans.forEach((child) => {
                    child.stages.forEach((stage) => {
                        grandTotalFutureCost += stage.calculatedFutureValue || 0;
                        grandTotalMonthlySaving += stage.calculatedMonthlySaving || 0;
                    });
                });
            }

            const outputResult = {
                totalFutureCost: grandTotalFutureCost,
                totalMonthlySaving: grandTotalMonthlySaving,
                childrenPlans: dto.childrenPlans,
            };

            const clientAge = dto.clientDob ? this.calculateAge(dto.clientDob) : null;

            // 3. Log Aktivitas
            const log = await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity,
                    clientJob: dto.clientJob || '-',
                    totalIncome: grandTotalFutureCost, // Proxy: Total Biaya Pendidikan
                    calculatedSurplus: grandTotalMonthlySaving, // Proxy: Total Tabungan
                    healthScore: 100,
                    status: HealthStatus.SEHAT,
                    moduleType: 'EDUCATION',
                    inputPayload: JSON.parse(
                        JSON.stringify(dto),
                    ) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(outputResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 4. Generate Token (Save & Continue)
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'EDUCATION',
                    simulationId: log.id,
                },
                data: dto,
            });

            // 5. Generate PDF (Return Buffer - dikirim ke Controller untuk Stream/Download)
            // Note: Di blueprint awal, Education PDF digenerate via controller terpisah karena kompleksitasnya,
            // tapi untuk konsistensi kita bisa return structure yang sama.
            // Namun, Education PDF logic-nya agak beda (via `downloadEducationPdfById`), jadi di sini kita return metadata sukses saja
            // atau null buffer jika frontend handle download via ID terpisah.

            // Sesuai kode lama: return status success, data, simulationId, dan token.
            const cleanName = dto.clientName.replace(/[^a-zA-Z0-9]/g, '_');

            return {
                status: 'success',
                data: outputResult,
                simulationId: log.id,
                mgcToken: mgcToken,
                filename: `Education_Plan_${cleanName}_${Date.now()}.pdf`,
                // PDF Buffer digenerate terpisah via endpoint GET /download/:id untuk modul ini
                // atau kita bisa panggil service PDF generator jika ingin langsung blob.
            };

        } catch (error: any) {
            this.logger.error(
                `Education Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi pendidikan.',
            );
        }
    }

    private calculateAge(dobString: string): number {
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    }
}