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
import { CreateGoalDto, SimulateGoalDto } from '../../dto/create-goal.dto';
import { CreateGoalSimulationDto } from '../../dto/create-goal-simulation.dto';
import {
    calculateGoalPlan,
    calculateGoalSimulation,
} from '../../utils/financial-math.util';
import { User, HealthStatus, Prisma } from '@prisma/client';

@Injectable()
export class GoalCalculatorService {
    private readonly logger = new Logger(GoalCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly marketSettingsService: MarketSettingsService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    /**
     * [PUBLIC/STATELESS] Simulasi Cepat (Calculator Only)
     */
    simulateGoal(dto: SimulateGoalDto) {
        // Bisa tambahkan logic ambil default rate jika dto.inflationRate kosong
        const result = calculateGoalSimulation(dto);
        return { status: 'success', data: result };
    }

    /**
     * [USER] Hitung & Simpan Goal ke Database
     */
    async calculateAndSaveGoal(userId: string, dto: CreateGoalDto) {
        // 1. Ambil Market Rates
        const marketRates = await this.marketSettingsService.getCurrentSettings();
        const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
        const returnRate = dto.returnRate ?? 6; // Default moderat

        // 2. Kalkulasi Core
        const result = calculateGoalPlan({
            ...dto,
            inflationRate,
            returnRate,
        });

        // 3. Simpan DB
        const plan = await this.prisma.goalPlan.create({
            data: {
                userId,
                goalName: dto.goalName,
                targetAmount: dto.targetAmount,
                targetDate: new Date(dto.targetDate),
                inflationRate,
                returnRate,
                futureValue: result.futureTargetAmount,
                monthlySaving: result.monthlySaving,
            },
        });

        return { plan, calculation: result };
    }

    /**
     * [AGENT] Simulasi Goal dengan PDF & Log
     */
    async simulateAgentGoal(user: User, dto: CreateGoalSimulationDto) {
        // 1. Validasi Quota
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Ambil Dynamic Rates
            const marketRates = await this.marketSettingsService.getCurrentSettings();
            const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
            const returnRate = dto.returnRate ?? 6;

            // 3. Kalkulasi Core
            const calculationResult = calculateGoalPlan({
                goalName: dto.goalName,
                targetAmount: dto.targetAmount,
                targetDate: dto.targetDate,
                inflationRate,
                returnRate,
            });

            // 4. Kalkulasi Tambahan (Existing Fund Growth)
            // Logic ini spesifik untuk simulasi agen yang memasukkan "Tabungan Saat Ini"
            const yearsDuration = calculationResult.monthsDuration / 12;
            const rRate = returnRate / 100;

            const futureExistingFund =
                (dto.currentSaving || 0) * Math.pow(1 + rRate, yearsDuration);

            const netTarget = Math.max(
                0,
                calculationResult.futureTargetAmount - futureExistingFund,
            );

            // Hitung ulang monthly saving berdasarkan net target
            let realMonthlySaving = 0;
            if (netTarget > 0) {
                const monthlyRate = rRate / 12;
                const months = calculationResult.monthsDuration;
                if (monthlyRate === 0) {
                    realMonthlySaving = netTarget / months;
                } else {
                    // Rumus PMT Future Value
                    realMonthlySaving =
                        (netTarget * monthlyRate) /
                        (Math.pow(1 + monthlyRate, months) - 1);
                }
            }

            const finalResult = {
                ...calculationResult,
                futureExistingFund,
                netTarget,
                monthlySaving: realMonthlySaving,
                yearsDuration,
            };

            const clientAge = this.calculateAge(dto.clientDob);

            // 5. Log Aktivitas
            await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity,
                    clientJob: dto.clientJob || '-',
                    totalIncome: dto.targetAmount, // Target Goal
                    calculatedSurplus: finalResult.monthlySaving, // Monthly Saving Needed
                    healthScore: 100,
                    status: HealthStatus.SEHAT,
                    financialRatios: JSON.parse(
                        JSON.stringify(finalResult),
                    ) as Prisma.InputJsonValue,
                    moduleType: 'GOAL',
                    inputPayload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(finalResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 6. Generate PDF
            const pdfBuffer = await this.pdfService.generateGoalSimulationPdfBuffer(
                dto,
                finalResult,
                user,
            );

            // 7. Generate Token
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'GOAL',
                },
                client: {
                    name: dto.clientName,
                    dob: dto.clientDob,
                    city: dto.clientCity,
                    job: dto.clientJob,
                    phone: dto.clientPhone,
                },
                financial: { ...dto },
                result: finalResult,
            });

            return {
                pdfBuffer,
                mgcToken,
                filename: `Goal_Plan_${dto.clientName.replace(
                    /[^a-zA-Z0-9]/g,
                    '_',
                )}_${Date.now()}.pdf`,
            };
        } catch (error: any) {
            this.logger.error(
                `Goal Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi tujuan keuangan.',
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