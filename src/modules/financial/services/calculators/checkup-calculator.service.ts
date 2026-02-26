import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { FinancialQuotaService } from '../core/financial-quota.service';
import { SimulationTokenService } from '../core/simulation-token.service';
import { User, HealthStatus, Prisma } from '@prisma/client';

// DTOs
import { CreateFinancialRecordDto } from '../../dto/create-financial-record.dto';
import { CreateCheckupSimulationDto } from '../../dto/create-checkup-simulation.dto';
import { CreateBudgetDto } from '../../dto/create-budget.dto';
import { CreateBudgetSimulationDto } from '../../dto/create-budget-simulation.dto';

// Math Utils
import {
    calculateFinancialHealth,
    calculateBudgetSplit,
    calculateAgentBudgetSimulation,
    HealthAnalysisResult,
    AgentBudgetSimulationResult,
} from '../../utils/financial-math.util';

@Injectable()
export class CheckupCalculatorService {
    private readonly logger = new Logger(CheckupCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    // ===========================================================================
    // DOMAIN: FINANCIAL CHECKUP (SELF SERVICE)
    // ===========================================================================

    async createCheckup(userId: string, dto: CreateFinancialRecordDto) {
        // 1. Kalkulasi Kesehatan Finansial
        const analysis = calculateFinancialHealth(dto);

        // 2. Mapping Status ke Enum DB
        let dbStatus: HealthStatus = HealthStatus.BAHAYA;
        if (analysis.globalStatus === 'SEHAT') dbStatus = HealthStatus.SEHAT;
        else if (analysis.globalStatus === 'WASPADA') dbStatus = HealthStatus.WASPADA;

        return this.prisma.financialCheckup.create({
            data: {
                userId,
                ...dto,
                // Gunakan casting unknown -> JsonObject untuk mengatasi error overlap tipe data
                userProfile: dto.userProfile as unknown as Prisma.JsonObject,
                spouseProfile: dto.spouseProfile
                    ? (dto.spouseProfile as unknown as Prisma.JsonObject)
                    : undefined,
                totalNetWorth: analysis.netWorth,
                surplusDeficit: analysis.surplusDeficit,
                healthScore: analysis.score,
                status: dbStatus,
                ratiosDetails: analysis.ratios as unknown as Prisma.JsonArray,
            },
        });
    }

    async getLatestCheckup(userId: string) {
        const checkup = await this.prisma.financialCheckup.findFirst({
            where: { userId },
            orderBy: { checkDate: 'desc' },
        });

        if (!checkup) return null;

        const val = (n: any) => Number(n) || 0;

        // Mapping ulang data aset & hutang untuk kemudahan frontend
        const assetInvestment =
            val(checkup.assetInvHome) +
            val(checkup.assetInvVehicle) +
            val(checkup.assetGold) +
            val(checkup.assetInvAntique) +
            val(checkup.assetStocks) +
            val(checkup.assetMutualFund) +
            val(checkup.assetBonds) +
            val(checkup.assetDeposit) +
            val(checkup.assetInvOther);

        const debtConsumptive =
            val(checkup.debtKPR) +
            val(checkup.debtKPM) +
            val(checkup.debtCC) +
            val(checkup.debtCoop) +
            val(checkup.debtConsumptiveOther);

        const incomeMonthly = val(checkup.incomeFixed) + val(checkup.incomeVariable);

        // Hitung total expense bulanan dari DB record
        const expenseMonthly =
            val(checkup.installmentKPR) +
            val(checkup.installmentKPM) +
            val(checkup.installmentCC) +
            val(checkup.installmentCoop) +
            val(checkup.installmentConsumptiveOther) +
            val(checkup.installmentBusiness) +
            val(checkup.insuranceLife) +
            val(checkup.insuranceHealth) +
            val(checkup.insuranceHome) +
            val(checkup.insuranceVehicle) +
            val(checkup.insuranceBPJS) +
            val(checkup.insuranceOther) +
            val(checkup.savingEducation) +
            val(checkup.savingRetirement) +
            val(checkup.savingPilgrimage) +
            val(checkup.savingHoliday) +
            val(checkup.savingEmergency) +
            val(checkup.savingOther) +
            val(checkup.expenseFood) +
            val(checkup.expenseSchool) +
            val(checkup.expenseTransport) +
            val(checkup.expenseCommunication) +
            val(checkup.expenseHelpers) +
            val(checkup.expenseTax) +
            val(checkup.expenseLifestyle);

        return {
            ...checkup,
            ratios: checkup.ratiosDetails,
            assetInvestment,
            debtConsumptive,
            debtProductive: val(checkup.debtBusiness),
            incomeMonthly,
            expenseMonthly,
            totalNetWorth: val(checkup.totalNetWorth),
            surplusDeficit: val(checkup.surplusDeficit),
            assetCash: val(checkup.assetCash),
        };
    }

    async getCheckupHistory(userId: string) {
        return this.prisma.financialCheckup.findMany({
            where: { userId },
            orderBy: { checkDate: 'desc' },
            select: {
                id: true,
                checkDate: true,
                healthScore: true,
                status: true,
                totalNetWorth: true,
            },
        });
    }

    async getCheckupDetail(userId: string, checkupId: string) {
        const checkup = await this.prisma.financialCheckup.findFirst({
            where: { id: checkupId, userId },
        });

        if (!checkup) {
            throw new NotFoundException('Data checkup tidak ditemukan');
        }

        return {
            score: checkup.healthScore,
            globalStatus: checkup.status,
            netWorth: Number(checkup.totalNetWorth),
            surplusDeficit: Number(checkup.surplusDeficit),
            ratios: checkup.ratiosDetails,
            generatedAt: checkup.checkDate.toISOString(),
            record: {
                ...checkup,
                assetCash: Number(checkup.assetCash),
                totalNetWorth: Number(checkup.totalNetWorth),
                surplusDeficit: Number(checkup.surplusDeficit),
            },
        };
    }

    // ===========================================================================
    // DOMAIN: BUDGETING (SELF SERVICE)
    // ===========================================================================

    async createBudget(userId: string, dto: CreateBudgetDto) {
        const totalIncome = dto.fixedIncome + dto.variableIncome;
        const isManualInput = dto.livingCost && dto.livingCost > 0;

        // Logic: Auto-Allocation jika user tidak input detail
        let finalAllocation = {
            livingCost: dto.livingCost || 0,
            productiveDebt: dto.productiveDebt || 0,
            consumptiveDebt: dto.consumptiveDebt || 0,
            insurance: dto.insurance || 0,
            saving: dto.saving || 0,
        };

        if (!isManualInput) {
            finalAllocation = calculateBudgetSplit(totalIncome);
        }

        const totalExpense =
            finalAllocation.productiveDebt +
            finalAllocation.consumptiveDebt +
            finalAllocation.insurance +
            finalAllocation.saving +
            finalAllocation.livingCost;

        const balance = totalIncome - totalExpense;

        let cashflowStatus = 'BALANCED';
        if (balance < 0) cashflowStatus = 'DEFISIT';
        if (balance > 0) cashflowStatus = 'SURPLUS';

        return this.prisma.$transaction(async (tx) => {
            // 1. Simpan Budget Plan
            const budget = await tx.budgetPlan.create({
                data: {
                    userId,
                    month: dto.month,
                    year: dto.year,
                    fixedIncome: dto.fixedIncome,
                    variableIncome: dto.variableIncome,
                    productiveDebt: finalAllocation.productiveDebt,
                    consumptiveDebt: finalAllocation.consumptiveDebt,
                    insurance: finalAllocation.insurance,
                    saving: finalAllocation.saving,
                    livingCost: finalAllocation.livingCost,
                    totalIncome,
                    totalExpense,
                    balance,
                    status: cashflowStatus,
                },
            });

            // 2. Analisa Kesehatan Budget (Simple Check)
            const analysis = this.analyzeBudgetHealth({
                ...dto,
                ...finalAllocation,
            });

            return { budget, analysis };
        });
    }

    async getMyBudgets(userId: string) {
        return this.prisma.budgetPlan.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 12,
        });
    }

    // ===========================================================================
    // DOMAIN: AGENT SIMULATION (CHECKUP & BUDGETING)
    // ===========================================================================

    async simulateAgentCheckup(user: User, dto: CreateCheckupSimulationDto) {
        // 1. Check Quota
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Kalkulasi
            const calculationInput: any = {
                ...dto,
                userProfile: dto.client,
                spouseProfile: dto.spouse,
            };
            const analysisResult = calculateFinancialHealth(calculationInput);

            const clientAge = this.calculateAge(dto.client.dob);
            let dbStatus: HealthStatus = HealthStatus.BAHAYA;
            if (analysisResult.globalStatus === 'SEHAT') dbStatus = HealthStatus.SEHAT;
            else if (analysisResult.globalStatus === 'WASPADA') dbStatus = HealthStatus.WASPADA;

            // 3. Log Activity
            await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.client.name,
                    clientAge: clientAge,
                    clientCity: dto.client.city,
                    clientJob: dto.client.occupation,
                    totalIncome: (dto.incomeFixed + dto.incomeVariable) * 12,
                    calculatedSurplus: analysisResult.surplusDeficit * 12,
                    healthScore: analysisResult.score,
                    status: dbStatus,
                    financialRatios: JSON.parse(
                        JSON.stringify(analysisResult.ratios),
                    ) as Prisma.InputJsonValue,
                    moduleType: 'CHECKUP',
                    inputPayload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(analysisResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 4. Generate PDF
            const pdfBuffer = await this.pdfService.generateCheckupSimulationPdfBuffer(
                dto,
                analysisResult,
                user,
            );

            // 5. Generate Token
            const { client, spouse, ...financialData } = dto;
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'CHECKUP',
                },
                client,
                spouse,
                financial: financialData,
                result: analysisResult,
            });

            const cleanName = dto.client.name.replace(/[^a-zA-Z0-9]/g, '_');
            return {
                pdfBuffer,
                mgcToken,
                filename: `Financial_Checkup_${cleanName}_${Date.now()}.pdf`,
                data: {
                    client,
                    spouse,
                    financial: financialData,
                    result: analysisResult,
                },
            };
        } catch (error: any) {
            this.logger.error(
                `Checkup Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi Financial Checkup.',
            );
        }
    }

    async simulateAgentBudget(user: User, dto: CreateBudgetSimulationDto) {
        // 1. Check Quota
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Kalkulasi
            const calculationResult: AgentBudgetSimulationResult = calculateAgentBudgetSimulation(
                dto.fixedIncome,
                dto.variableIncome,
            );

            const clientAge = this.calculateAge(dto.clientDob);

            // 3. Log Activity
            await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity,
                    clientJob: dto.clientJob,
                    totalIncome: calculationResult.meta.totalIncome,
                    calculatedSurplus: calculationResult.analysis.totalRecommendedSavings,
                    healthScore: 100,
                    status: HealthStatus.SEHAT,
                    financialRatios: JSON.parse(
                        JSON.stringify(calculationResult.allocation),
                    ) as Prisma.InputJsonValue,
                    moduleType: 'BUDGETING',
                    inputPayload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(calculationResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 4. PDF
            const pdfBuffer = await this.pdfService.generateSimulationPdfBuffer(
                dto,
                calculationResult,
                user,
            );

            // 5. Token
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                },
                client: {
                    name: dto.clientName,
                    dob: dto.clientDob,
                    city: dto.clientCity,
                    job: dto.clientJob,
                    phone: dto.clientPhone,
                },
                financial: {
                    fixedIncome: dto.fixedIncome,
                    variableIncome: dto.variableIncome,
                },
                result: calculationResult,
            });

            return {
                pdfBuffer,
                mgcToken,
                filename: `Budget_${dto.clientName.replace(
                    /[^a-zA-Z0-9]/g,
                    '_',
                )}_${Date.now()}.pdf`,
            };
        } catch (error: any) {
            this.logger.error(`Simulation Error: ${error.message}`, error.stack);
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Terjadi kesalahan saat memproses simulasi budgeting.',
            );
        }
    }

    // ===========================================================================
    // PRIVATE HELPERS
    // ===========================================================================

    private analyzeBudgetHealth(dto: CreateBudgetDto) {
        let score = 100;
        const violations: string[] = [];
        const base = Number(dto.fixedIncome);

        if (base === 0)
            return {
                score: 0,
                status: 'BAHAYA',
                recommendation: 'Wajib input Gaji Tetap.',
            };

        if (Number(dto.productiveDebt) > base * 0.2) {
            score -= 10;
            violations.push('Hutang Produktif > 20%');
        }
        if (Number(dto.consumptiveDebt) > base * 0.15) {
            score -= 20;
            violations.push('Hutang Konsumtif > 15%');
        }
        if (Number(dto.insurance) < base * 0.1) {
            score -= 10;
            violations.push('Asuransi < 10%');
        }
        if (Number(dto.saving) < base * 0.1) {
            score -= 20;
            violations.push('Tabungan < 10%');
        }

        const totalExpense =
            Number(dto.productiveDebt) +
            Number(dto.consumptiveDebt) +
            Number(dto.insurance) +
            Number(dto.saving) +
            Number(dto.livingCost);

        if (
            totalExpense >
            Number(dto.fixedIncome) + Number(dto.variableIncome)
        ) {
            score -= 30;
            violations.push('DEFISIT! Pengeluaran > Pemasukan');
        }

        if (score < 0) score = 0;

        let status = 'SEHAT';
        if (score < 80) status = 'WASPADA';
        if (score < 60) status = 'BAHAYA';

        let recommendation = 'Anggaran Sehat.';
        if (violations.length > 0)
            recommendation = `Perbaiki: ${violations.join(', ')}.`;

        return { score, status, recommendation };
    }

    private calculateAge(dobString: string): number {
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    }
}