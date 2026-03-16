import {
    Injectable,
    Logger,
    InternalServerErrorException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { MarketSettingsService } from '../../../master-data/services/market-settings.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { FinancialQuotaService } from '../core/financial-quota.service';
import { SimulationTokenService } from '../core/simulation-token.service';
import { CreatePensionDto } from '../../dto/create-pension.dto';
import { CreatePensionSimulationDto } from '../../dto/create-pension-simulation.dto';
import { calculatePensionPlan } from '../../utils/financial-math.util';
import { User, HealthStatus, Prisma } from '@prisma/client';

@Injectable()
export class PensionCalculatorService {
    private readonly logger = new Logger(PensionCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly marketSettingsService: MarketSettingsService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    /**
     * [USER] Hitung & Simpan Rencana Pensiun ke Database
     */
    async calculateAndSavePension(userId: string, dto: CreatePensionDto) {
        // 1. Ambil Data Pasar (Central Bank)
        const marketRates = await this.marketSettingsService.getSettings();

        // 2. Tentukan Rate (Prioritas: Input User > Default Market)
        const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
        const returnRate = dto.returnRate ?? 8; // Default asumsi return moderat

        // 3. Kalkulasi Core
        const result = calculatePensionPlan({
            ...dto,
            lifeExpectancy: dto.lifeExpectancy ?? 80,
            currentSaving: dto.currentSaving ?? 0,
            inflationRate: inflationRate,
            returnRate: returnRate,
        });

        // 4. Simpan ke DB
        const plan = await this.prisma.pensionPlan.create({
            data: {
                userId,
                currentAge: dto.currentAge,
                retirementAge: dto.retirementAge,
                lifeExpectancy: dto.lifeExpectancy,
                currentExpense: dto.currentExpense,
                currentSaving: dto.currentSaving,
                inflationRate: inflationRate,
                returnRate: returnRate,
                totalFundNeeded: result.totalFundNeeded,
                monthlySaving: result.monthlySaving,
            },
        });

        return { plan, calculation: result };
    }

    /**
     * [AGENT] Simulasi Dana Pensiun (PDF + Token + Log)
     */
    async simulateAgentPension(user: User, dto: CreatePensionSimulationDto) {
        // 1. Validasi Quota & Idempotency (via Core Service)
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Ambil Dynamic Rates
            const marketRates = await this.marketSettingsService.getSettings();
            const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
            const returnRate = dto.returnRate ?? 8;

            // 3. Kalkulasi Core
            const calculationResult = calculatePensionPlan({
                currentAge: dto.currentAge,
                retirementAge: dto.retirementAge,
                lifeExpectancy: dto.lifeExpectancy ?? 80,
                currentExpense: dto.currentExpense,
                currentSaving: dto.currentSaving ?? 0,
                inflationRate: inflationRate,
                returnRate: returnRate,
            });

            const clientAge = this.calculateAge(dto.clientDob);

            // 4. Log Aktivitas Simulasi
            await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity,
                    clientJob: dto.clientJob || '-',
                    totalIncome: dto.currentExpense,
                    calculatedSurplus: calculationResult.shortfall,
                    healthScore: 100,
                    status: HealthStatus.SEHAT,
                    financialRatios: JSON.parse(
                        JSON.stringify(calculationResult),
                    ) as Prisma.InputJsonValue,
                    moduleType: 'PENSION',
                    inputPayload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(calculationResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 5. Generate PDF
            const pdfBuffer = await this.pdfService.generatePensionPdfBuffer(
                dto,
                calculationResult,
                user,
            );

            // 6. Generate Magic Token (Save & Continue)
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'PENSION',
                },
                client: {
                    name: dto.clientName,
                    dob: dto.clientDob,
                    city: dto.clientCity,
                    job: dto.clientJob,
                    phone: dto.clientPhone,
                },
                financial: { ...dto },
                result: calculationResult,
            });

            return {
                pdfBuffer,
                mgcToken,
                filename: `Pension_Plan_${dto.clientName.replace(
                    /[^a-zA-Z0-9]/g,
                    '_',
                )}_${Date.now()}.pdf`,
            };
        } catch (error: any) {
            this.logger.error(
                `Pension Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi dana pensiun.',
            );
        }
    }

    // Helper Private (Duplikasi kecil untuk kemandirian service)
    private calculateAge(dobString: string): number {
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    }
}