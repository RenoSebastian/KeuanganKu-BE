import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import * as nodeCrypto from 'crypto';
import { SchoolLevel, HealthStatus, User, Prisma } from '@prisma/client'; // Added Prisma import for Json types

// DTOs - Existing Modules
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';

// DTOs - Risk Profile Feature
import { CalculateRiskProfileDto } from './dto/calculate-risk-profile.dto';
import { RiskProfileResponseDto } from './dto/risk-profile-response.dto';

// DTOs - Agent Simulation Feature
import { CreateBudgetSimulationDto } from './dto/create-budget-simulation.dto';
import { ImportSimulationDto } from './dto/import-simulation.dto';
import { CreateInsuranceSimulationDto } from './dto/create-insurance-simulation.dto';
import { CreatePensionSimulationDto } from './dto/create-pension-simulation.dto';
import { CreateGoalSimulationDto } from './dto/create-goal-simulation.dto';
import { CreateCheckupSimulationDto } from './dto/create-checkup-simulation.dto';
import { CreateRiskProfileSimulationDto } from './dto/create-risk-profile-simulation.dto';

// Services
import { PdfGeneratorService } from './services/pdf-generator.service';

// Math Utilities
import {
  calculateFinancialHealth,
  calculatePensionPlan,
  calculateInsurancePlan,
  calculateGoalPlan,
  calculateGoalSimulation,
  calculateEducationPlan,
  calculateBudgetSplit,
  calculateRiskProfileAnalysis,
  calculateAgentBudgetSimulation,
  AgentBudgetSimulationResult,
  HealthAnalysisResult,
} from './utils/financial-math.util';

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);
  private readonly RETENTION_SECRET: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pdfService: PdfGeneratorService,
  ) {
    this.RETENTION_SECRET = this.configService.get<string>(
      'RETENTION_SECRET',
      'DEFAULT_SECRET_DO_NOT_USE_IN_PROD_PLEASE_CHANGE_ME',
    );
  }

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (The "Medical" Check)
  // ===========================================================================

  async createCheckup(userId: string, dto: CreateFinancialRecordDto) {
    const analysis = calculateFinancialHealth(dto);

    let dbStatus: HealthStatus = HealthStatus.BAHAYA;
    if (analysis.globalStatus === 'SEHAT') dbStatus = HealthStatus.SEHAT;
    else if (analysis.globalStatus === 'WASPADA') dbStatus = HealthStatus.WASPADA;

    return this.prisma.financialCheckup.create({
      data: {
        userId,
        ...dto,
        userProfile: dto.userProfile as any,
        spouseProfile: dto.spouseProfile ? (dto.spouseProfile as any) : undefined,
        totalNetWorth: analysis.netWorth,
        surplusDeficit: analysis.surplusDeficit,
        healthScore: analysis.score,
        status: dbStatus,
        ratiosDetails: analysis.ratios as any,
      },
    });
  }

  async getLatestCheckup(userId: string, actorRole?: string) {
    const checkup = await this.prisma.financialCheckup.findFirst({
      where: { userId },
      orderBy: { checkDate: 'desc' },
    });

    if (!checkup) return null;

    const val = (n: any) => Number(n) || 0;

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

    const debtProductive = val(checkup.debtBusiness);
    const incomeMonthly = val(checkup.incomeFixed) + val(checkup.incomeVariable);

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
      debtProductive,
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
  // MODULE 2: BUDGET PLAN (The "Monthly" Plan)
  // ===========================================================================

  async createBudget(userId: string, dto: CreateBudgetDto) {
    const totalIncome = dto.fixedIncome + dto.variableIncome;
    const isManualInput = dto.livingCost && dto.livingCost > 0;

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
  // MODULE 3: CALCULATOR - PENSION PLAN (DB BASED)
  // ===========================================================================

  async calculateAndSavePension(userId: string, dto: CreatePensionDto) {
    // [FIX] Provide default values for optional fields to satisfy math engine requirement
    const result = calculatePensionPlan({
      ...dto,
      lifeExpectancy: dto.lifeExpectancy ?? 80,
      currentSaving: dto.currentSaving ?? 0,
      inflationRate: dto.inflationRate ?? 5,
      returnRate: dto.returnRate ?? 8,
    });

    const plan = await this.prisma.pensionPlan.create({
      data: {
        userId,
        currentAge: dto.currentAge,
        retirementAge: dto.retirementAge,
        lifeExpectancy: dto.lifeExpectancy,
        currentExpense: dto.currentExpense,
        currentSaving: dto.currentSaving,
        inflationRate: dto.inflationRate,
        returnRate: dto.returnRate,
        totalFundNeeded: result.totalFundNeeded,
        monthlySaving: result.monthlySaving,
      },
    });
    return { plan, calculation: result };
  }

  // ===========================================================================
  // MODULE 4: CALCULATOR - INSURANCE PLAN
  // ===========================================================================

  async calculateAndSaveInsurance(userId: string, dto: CreateInsuranceDto) {
    const result = calculateInsurancePlan(dto);
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
        inflationRate: dto.inflationRate ?? 5,
        returnRate: dto.returnRate ?? 7,
        coverageNeeded: result.totalNeeded,
        recommendation: result.recommendation,
      },
    });
    return { plan, calculation: result };
  }

  // ===========================================================================
  // MODULE 5: CALCULATOR - GOAL PLAN
  // ===========================================================================

  simulateGoal(userId: string, dto: SimulateGoalDto) {
    const result = calculateGoalSimulation(dto);
    return { status: 'success', data: result };
  }

  async calculateAndSaveGoal(userId: string, dto: CreateGoalDto) {
    const result = calculateGoalPlan(dto);
    const plan = await this.prisma.goalPlan.create({
      data: {
        userId,
        goalName: dto.goalName,
        targetAmount: dto.targetAmount,
        targetDate: new Date(dto.targetDate),
        inflationRate: dto.inflationRate,
        returnRate: dto.returnRate,
        futureValue: result.futureTargetAmount,
        monthlySaving: result.monthlySaving,
      },
    });
    return { plan, calculation: result };
  }

  // ===========================================================================
  // MODULE 6: CALCULATOR - EDUCATION PLAN
  // ===========================================================================

  async calculateAndSaveEducation(userId: string, dto: CreateEducationPlanDto) {
    const result = calculateEducationPlan(dto);
    const savedData = await this.prisma.$transaction(async (tx) => {
      const plan = await tx.educationPlan.create({
        data: {
          userId,
          childName: dto.childName,
          childDob: new Date(dto.childDob),
          inflationRate: dto.inflationRate,
          returnRate: dto.returnRate,
          method: dto.method,
        },
      });

      const stagesData = result.stagesBreakdown.map((stage) => {
        let dbLevel: SchoolLevel = stage.level;
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

      await tx.educationStage.createMany({ data: stagesData });
      return plan;
    });

    return { plan: savedData, calculation: result };
  }

  async getEducationPlans(userId: string) {
    const plans = await this.prisma.educationPlan.findMany({
      where: { userId },
      include: { stages: true },
      orderBy: { createdAt: 'desc' },
    });

    return plans.map((p) => {
      const { stages, ...planData } = p;
      const totalFutureCost = stages.reduce((acc, s) => acc + Number(s.futureCost), 0);
      const totalMonthlySaving = stages.reduce((acc, s) => acc + Number(s.monthlySaving), 0);
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

  async deleteEducationPlan(userId: string, planId: string) {
    const plan = await this.prisma.educationPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) throw new NotFoundException('Rencana pendidikan tidak ditemukan');
    return this.prisma.educationPlan.delete({ where: { id: planId } });
  }

  // ===========================================================================
  // MODULE 7: RISK PROFILE CALCULATOR (STATELESS)
  // ===========================================================================

  calculateRiskProfile(dto: CalculateRiskProfileDto): RiskProfileResponseDto {
    const analysis = calculateRiskProfileAnalysis(dto.answers as any); // Cast to any to resolve type mismatch
    return {
      calculatedAt: new Date().toISOString(),
      clientName: dto.clientName,
      totalScore: analysis.totalScore,
      riskProfile: analysis.profile,
      riskDescription: analysis.description,
      allocation: analysis.allocation,
    };
  }

  // ===========================================================================
  // MODULE 8: AGENT BUDGET SIMULATION (STATELESS UPDATE)
  // ===========================================================================

  async simulateAgentBudget(user: User, dto: CreateBudgetSimulationDto) {
    try {
      const calculationResult: AgentBudgetSimulationResult = calculateAgentBudgetSimulation(
        dto.fixedIncome,
        dto.variableIncome,
      );

      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity,
          clientJob: dto.clientJob,
          totalIncome: calculationResult.meta.totalIncome,
          calculatedSurplus: calculationResult.analysis.totalRecommendedSavings,
          healthScore: 100,
          status: HealthStatus.SEHAT,
          financialRatios: JSON.parse(JSON.stringify(calculationResult.allocation)) as Prisma.InputJsonValue,
          moduleType: 'BUDGETING',
        },
      });

      const pdfBuffer = await this.pdfService.generateSimulationPdfBuffer(
        dto,
        calculationResult,
        user,
      );

      const mgcToken = this.generateMgcToken({
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
        filename: `Budget_${dto.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`
      };

    } catch (error: any) {
      this.logger.error(`Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Terjadi kesalahan saat memproses simulasi budgeting.');
    }
  }

  async verifyAndDecodeSimulationToken(dto: ImportSimulationDto) {
    const { simulationToken } = dto;

    if (!simulationToken.includes('.')) {
      throw new BadRequestException('Format file .mgc tidak valid atau rusak.');
    }

    const [payloadBase64, providedSignature] = simulationToken.split('.');
    const expectedSignature = this.createHmacSignature(payloadBase64);

    const signatureBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      nodeCrypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      this.logger.warn('Security Alert: Invalid Signature on .mgc import.');
      throw new BadRequestException(
        'File simulasi (.mgc) tidak valid atau telah dimodifikasi. Import ditolak demi keamanan data.',
      );
    }

    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const data = JSON.parse(payloadJson);

      return {
        message: 'File simulasi berhasil di-import.',
        data: {
          client: data.client,
          financial: data.financial,
          last_simulation_date: data.meta.generatedAt,
          spouse: data.spouse,
        },
      };
    } catch (error) {
      throw new BadRequestException('Gagal membaca isi file simulasi. Encoding rusak.');
    }
  }

  // ===========================================================================
  // MODULE 9: AGENT INSURANCE SIMULATION (STATELESS)
  // ===========================================================================

  async simulateAgentInsurance(user: User, dto: CreateInsuranceSimulationDto) {
    try {
      const calculationResult = calculateInsurancePlan({
        type: dto.type,
        dependentCount: dto.dependentCount,
        monthlyExpense: dto.monthlyExpense,
        existingDebt: dto.existingDebt,
        existingCoverage: dto.existingCoverage,
        protectionDuration: dto.protectionDuration,
        finalExpense: dto.finalExpense ?? 0,
        inflationRate: dto.inflationRate ?? 5,
        returnRate: dto.returnRate ?? 7,
      });

      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity,
          clientJob: dto.clientJob,
          totalIncome: dto.monthlyExpense * 12,
          calculatedSurplus: calculationResult.coverageGap,
          healthScore: 100,
          status: HealthStatus.SEHAT,
          financialRatios: JSON.parse(JSON.stringify(calculationResult)) as Prisma.InputJsonValue,
          moduleType: 'INSURANCE',
        },
      });

      const pdfBuffer = await this.pdfService.generateInsurancePdfBuffer(
        dto,
        calculationResult,
        user,
      );

      const mgcToken = this.generateMgcToken({
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
        filename: `Insurance_Plan_${dto.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`,
      };

    } catch (error: any) {
      this.logger.error(`Insurance Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi asuransi.');
    }
  }

  // ===========================================================================
  // MODULE 10: AGENT PENSION SIMULATION (STATELESS)
  // ===========================================================================

  async simulateAgentPension(user: User, dto: CreatePensionSimulationDto) {
    try {
      const calculationResult = calculatePensionPlan({
        currentAge: dto.currentAge,
        retirementAge: dto.retirementAge,
        lifeExpectancy: dto.lifeExpectancy ?? 80,
        currentExpense: dto.currentExpense,
        currentSaving: dto.currentSaving ?? 0,
        inflationRate: dto.inflationRate ?? 5,
        returnRate: dto.returnRate ?? 8,
      });

      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity,
          clientJob: dto.clientJob || '-',
          totalIncome: dto.currentExpense,
          calculatedSurplus: calculationResult.shortfall,
          healthScore: 100,
          status: HealthStatus.SEHAT,
          financialRatios: JSON.parse(JSON.stringify(calculationResult)) as Prisma.InputJsonValue,
          moduleType: 'PENSION',
        },
      });

      const pdfBuffer = await this.pdfService.generatePensionPdfBuffer(
        dto,
        calculationResult,
        user,
      );

      const mgcToken = this.generateMgcToken({
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
        filename: `Pension_Plan_${dto.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`,
      };

    } catch (error: any) {
      this.logger.error(`Pension Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi dana pensiun.');
    }
  }

  // ===========================================================================
  // MODULE 11: AGENT GOAL SIMULATION (STATELESS)
  // ===========================================================================

  async simulateAgentGoal(user: User, dto: CreateGoalSimulationDto) {
    try {
      const calculationResult = calculateGoalPlan({
        goalName: dto.goalName,
        targetAmount: dto.targetAmount,
        targetDate: dto.targetDate,
        inflationRate: dto.inflationRate ?? 5,
        returnRate: dto.returnRate ?? 6,
      });

      const yearsDuration = calculationResult.monthsDuration / 12;
      const rRate = (dto.returnRate ?? 6) / 100;

      const futureExistingFund = (dto.currentSaving || 0) * Math.pow(1 + rRate, yearsDuration);
      const netTarget = Math.max(0, calculationResult.futureTargetAmount - futureExistingFund);

      let realMonthlySaving = 0;
      if (netTarget > 0) {
        const monthlyRate = rRate / 12;
        const months = calculationResult.monthsDuration;
        if (monthlyRate === 0) {
          realMonthlySaving = netTarget / months;
        } else {
          realMonthlySaving = (netTarget * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
        }
      }

      const finalResult = {
        ...calculationResult,
        futureExistingFund,
        netTarget,
        monthlySaving: realMonthlySaving,
        yearsDuration
      };

      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity,
          clientJob: dto.clientJob || '-',
          totalIncome: dto.targetAmount,
          calculatedSurplus: finalResult.monthlySaving,
          healthScore: 100,
          status: HealthStatus.SEHAT,
          financialRatios: JSON.parse(JSON.stringify(finalResult)) as Prisma.InputJsonValue,
          moduleType: 'GOAL',
        },
      });

      const pdfBuffer = await this.pdfService.generateGoalSimulationPdfBuffer(
        dto,
        finalResult,
        user,
      );

      const mgcToken = this.generateMgcToken({
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
        filename: `Goal_Plan_${dto.clientName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`,
      };

    } catch (error: any) {
      this.logger.error(`Goal Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi tujuan keuangan.');
    }
  }

  // ===========================================================================
  // MODULE 12: FINANCIAL CHECKUP SIMULATION (STATELESS & AGENT MODE)
  // ===========================================================================

  async simulateAgentCheckup(user: User, dto: CreateCheckupSimulationDto) {
    try {
      // 1. CALCULATE
      const calculationInput: any = {
        ...dto,
      };

      const analysisResult: HealthAnalysisResult = calculateFinancialHealth(calculationInput);

      // 2. LOGGING
      const clientAge = this.calculateAge(dto.client.dob);
      let dbStatus: HealthStatus = HealthStatus.BAHAYA;
      if (analysisResult.globalStatus === 'SEHAT') dbStatus = HealthStatus.SEHAT;
      else if (analysisResult.globalStatus === 'WASPADA') dbStatus = HealthStatus.WASPADA;

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.client.city,
          clientJob: dto.client.occupation,
          totalIncome: (dto.incomeFixed + dto.incomeVariable) * 12,
          calculatedSurplus: analysisResult.surplusDeficit * 12,
          healthScore: analysisResult.score,
          status: dbStatus,
          // [FIX] Explicit serialization/casting for Prisma JSON
          financialRatios: JSON.parse(JSON.stringify(analysisResult.ratios)) as Prisma.InputJsonValue,
          moduleType: 'CHECKUP',
        },
      });

      // 3. PDF GENERATION
      const pdfBuffer = await this.pdfService.generateCheckupSimulationPdfBuffer(
        dto,
        analysisResult,
        user,
      );

      // 4. TOKENIZATION
      const mgcToken = this.generateMgcToken({
        meta: {
          version: '1.0',
          generatedAt: new Date().toISOString(),
          agentId: user.id,
          module: 'CHECKUP',
        },
        client: dto.client,
        spouse: dto.spouse,
        financial: {
          ...Object.fromEntries(Object.entries(dto).filter(([k]) => k !== 'client' && k !== 'spouse'))
        },
        result: {
          score: analysisResult.score,
          status: analysisResult.globalStatus,
          netWorth: analysisResult.netWorth
        }
      });

      // 5. PACKAGING
      const cleanName = dto.client.name.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        pdfBuffer,
        mgcToken,
        filename: `Financial_Checkup_${cleanName}_${Date.now()}.pdf`,
      };

    } catch (error: any) {
      this.logger.error(`Checkup Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi Financial Checkup.');
    }
  }

  // ===========================================================================
  // MODULE 13: RISK PROFILE SIMULATION (STATELESS & AGENT MODE)
  // ===========================================================================

  async simulateAgentRiskProfile(user: User, dto: CreateRiskProfileSimulationDto) {
    try {
      // 1. CALCULATE
      // Reuse logic from 'calculateRiskProfileAnalysis'
      // Cast to any since the types in DTO and util might differ slightly but structure is compatible
      const analysisResult = calculateRiskProfileAnalysis(dto.answers as any);

      // 2. LOGGING
      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity || '-',
          clientJob: dto.clientJob || '-',
          totalIncome: 0, // Not applicable for Risk Profile
          calculatedSurplus: 0,
          healthScore: analysisResult.totalScore, // Store score here
          status: HealthStatus.SEHAT, // Default as risk profile is descriptive
          financialRatios: {
            profile: analysisResult.profile,
            allocation: analysisResult.allocation
          } as unknown as Prisma.InputJsonValue, // Explicit cast for Prisma JSON
          moduleType: 'RISK_PROFILE',
        },
      });

      // Prepare Response DTO properly
      const riskProfileResponse: RiskProfileResponseDto = {
        calculatedAt: new Date().toISOString(),
        clientName: dto.clientName,
        clientDob: dto.clientDob, // Optional but good to pass if available
        totalScore: analysisResult.totalScore,
        riskProfile: analysisResult.profile,
        riskDescription: analysisResult.description,
        allocation: analysisResult.allocation
      };

      // 3. PDF GENERATION
      // Make sure generateRiskProfileSimulationPdfBuffer exists in PdfGeneratorService
      const pdfBuffer = await this.pdfService.generateRiskProfileSimulationPdfBuffer(
        dto,
        riskProfileResponse,
        user
      );

      // 4. TOKENIZATION
      const mgcToken = this.generateMgcToken({
        meta: {
          version: '1.0',
          generatedAt: new Date().toISOString(),
          agentId: user.id,
          module: 'RISK_PROFILE',
        },
        client: {
          name: dto.clientName,
          dob: dto.clientDob,
          city: dto.clientCity,
          job: dto.clientJob,
          phone: dto.clientPhone,
        },
        financial: {
          answers: dto.answers // Simpan jawaban kuesioner agar bisa direstore
        },
        result: analysisResult,
      });

      // 5. PACKAGING
      const cleanName = dto.clientName.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        pdfBuffer,
        mgcToken,
        filename: `Risk_Profile_${cleanName}_${Date.now()}.pdf`,
      };

    } catch (error: any) {
      this.logger.error(`Risk Profile Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi Profil Risiko.');
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private analyzeBudgetHealth(dto: CreateBudgetDto) {
    let score = 100;
    const violations: string[] = [];
    const base = Number(dto.fixedIncome);

    if (base === 0) return { score: 0, status: 'BAHAYA', recommendation: 'Wajib input Gaji Tetap.' };

    if (Number(dto.productiveDebt) > base * 0.2) { score -= 10; violations.push('Hutang Produktif > 20%'); }
    if (Number(dto.consumptiveDebt) > base * 0.15) { score -= 20; violations.push('Hutang Konsumtif > 15%'); }
    if (Number(dto.insurance) < base * 0.1) { score -= 10; violations.push('Asuransi < 10%'); }
    if (Number(dto.saving) < base * 0.1) { score -= 20; violations.push('Tabungan < 10%'); }

    const totalExpense =
      Number(dto.productiveDebt) +
      Number(dto.consumptiveDebt) +
      Number(dto.insurance) +
      Number(dto.saving) +
      Number(dto.livingCost);

    if (totalExpense > Number(dto.fixedIncome) + Number(dto.variableIncome)) {
      score -= 30;
      violations.push('DEFISIT! Pengeluaran > Pemasukan');
    }

    if (score < 0) score = 0;

    let status = 'SEHAT';
    if (score < 80) status = 'WASPADA';
    if (score < 60) status = 'BAHAYA';

    let recommendation = 'Anggaran Sehat.';
    if (violations.length > 0) recommendation = `Perbaiki: ${violations.join(', ')}.`;

    return { score, status, recommendation };
  }

  private generateMgcToken(payload: any): string {
    const jsonString = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(jsonString).toString('base64');
    const signature = this.createHmacSignature(payloadBase64);

    return `${payloadBase64}.${signature}`;
  }

  private createHmacSignature(data: string): string {
    return nodeCrypto
      .createHmac('sha256', this.RETENTION_SECRET)
      .update(data)
      .digest('hex');
  }

  private calculateAge(dobString: string): number {
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }
}