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
import { CreateInsuranceDto } from '../../dto/create-insurance.dto';
import { CreateInsuranceSimulationDto } from '../../dto/create-insurance-simulation.dto';
import { calculateInsurancePlan } from '../../utils/financial-math.util';
import { User, HealthStatus, Prisma } from '@prisma/client';

@Injectable()
export class InsuranceCalculatorService {
    private readonly logger = new Logger(InsuranceCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly marketSettingsService: MarketSettingsService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    /**
     * [USER] Hitung & Simpan Kebutuhan Asuransi
     */
    async calculateAndSaveInsurance(userId: string, dto: CreateInsuranceDto) {
        // 1. Ambil Data Pasar
        const marketRates = await this.marketSettingsService.getCurrentSettings();
        const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
        const returnRate = dto.returnRate ?? 7; // Default asumsi konservatif

        // 2. Kalkulasi Core
        const result = calculateInsurancePlan({
            ...dto,
            inflationRate,
            returnRate,
        });

        // 3. Simpan DB
        const plan = await this.prisma.insurancePlan.create({
            data: {
                userId,
                type: dto.type,
                dependentCount: dto.dependentCount,
                monthlyExpense: dto.monthlyExpense,
                existingDebt: dto.existingDebt,
                existingCoverage: dto.existingCoverage,
                protectionDuration: dto.protectionDuration,
                finalExpense: dto.finalExpense ?? 0,
                inflationRate: inflationRate,
                returnRate: returnRate,
                coverageNeeded: result.totalNeeded,
                recommendation: result.recommendation,
            },
        });

        return { plan, calculation: result };
    }

    /**
     * [AGENT] Simulasi Kebutuhan Asuransi (PDF + Token + Log)
     */
    async simulateAgentInsurance(user: User, dto: CreateInsuranceSimulationDto) {
        // 1. Validasi Quota
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Kalkulasi Core (Asuransi biasanya tidak pakai market rate dinamis kompleks, 
            // tapi kita tetap support override jika ada di DTO)
            const calculationResult = calculateInsurancePlan({
                type: dto.type,
                dependentCount: dto.dependents,
                monthlyExpense: dto.monthlyExpense,
                existingDebt: dto.existingDebt,
                existingCoverage: dto.existingCoverage,
                protectionDuration: dto.protectionDuration,
                finalExpense: dto.finalExpense ?? 0,
                inflationRate: dto.inflationRate ?? 5,
                returnRate: dto.returnRate ?? 7,
            });

            const clientAge = this.calculateAge(dto.clientDob);

            // 3. Log Aktivitas
            await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity,
                    clientJob: dto.clientJob,
                    totalIncome: dto.monthlyExpense * 12, // Proxy: Expense tahunan
                    calculatedSurplus: calculationResult.coverageGap, // Shortfall UP
                    healthScore: 100,
                    status: HealthStatus.SEHAT,
                    financialRatios: JSON.parse(
                        JSON.stringify(calculationResult),
                    ) as Prisma.InputJsonValue,
                    moduleType: 'INSURANCE',
                    inputPayload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(calculationResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 4. Generate PDF
            const pdfBuffer = await this.pdfService.generateInsurancePdfBuffer(
                dto,
                calculationResult,
                user,
            );

            // 5. Generate Token
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'INSURANCE',
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
                filename: `Insurance_Plan_${dto.clientName.replace(
                    /[^a-zA-Z0-9]/g,
                    '_',
                )}_${Date.now()}.pdf`,
            };
        } catch (error: any) {
            this.logger.error(
                `Insurance Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi asuransi.',
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