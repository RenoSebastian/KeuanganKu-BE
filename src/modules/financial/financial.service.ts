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
import { SchoolLevel, HealthStatus, User, Prisma } from '@prisma/client';

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
import { CreateEducationSimulationDto } from './dto/create-education-simulation.dto';

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
    // [FIX]: Tampung dulu di variabel sementara agar aman
    const secretEnv = this.configService.get<string>('RETENTION_SECRET');

    if (!secretEnv) {
      this.logger.warn('WARNING: RETENTION_SECRET is not set in .env. Using unsafe default secret!');
      this.RETENTION_SECRET = 'DEFAULT_SECRET_DO_NOT_USE_IN_PROD_PLEASE_CHANGE_ME';
    } else {
      this.RETENTION_SECRET = secretEnv;
    }
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
    const analysis = calculateRiskProfileAnalysis(dto.answers as any);
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

  // ===========================================================================
  // [REVISED] FINANCIAL CHECKUP SIMULATION (Item 2.1 & 3.1 & 2.2 Alignment)
  // ===========================================================================

  async simulateAgentCheckup(user: User, dto: CreateCheckupSimulationDto) {
    try {
      // 1. CALCULATE
      // [FIX ERROR 2345]: Mapping manual client -> userProfile agar cocok dengan math engine
      const calculationInput: any = {
        ...dto,
        userProfile: dto.client, // Menjembatani perbedaan nama field
        spouseProfile: dto.spouse,
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

      // 4. [ITEM 3.1 & FIX ERROR 2790] COMPREHENSIVE TOKEN PACKING
      // Kita menggunakan destructuring untuk memisahkan client/spouse 
      // daripada menggunakan 'delete' operator yang dilarang pada non-optional field.
      const { client, spouse, ...financialData } = dto;

      const mgcToken = this.generateMgcToken({
        meta: {
          version: '1.0',
          generatedAt: new Date().toISOString(),
          agentId: user.id,
          module: 'CHECKUP',
        },
        client: client,
        spouse: spouse,
        financial: financialData,
        result: analysisResult
      });

      // 5. [ITEM 2.1] RETURN EXPLICIT JSON RESULT
      const cleanName = dto.client.name.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        pdfBuffer,
        mgcToken,
        filename: `Financial_Checkup_${cleanName}_${Date.now()}.pdf`,
        data: {
          client: client,
          spouse: spouse,
          financial: financialData,
          result: analysisResult
        }
      };

    } catch (error: any) {
      this.logger.error(`Checkup Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi Financial Checkup.');
    }
  }


  // [TAHAP 2.3] Revised verifyAndDecodeSimulationToken
  // Robust validation and error handling
  async verifyAndDecodeSimulationToken(dto: ImportSimulationDto) {
    const { simulationToken } = dto;

    // 1. Validasi Format Dasar (Pencegahan Error Split)
    // Trim whitespace yang mungkin terbawa dari Frontend/File text
    const cleanToken = simulationToken?.trim();

    if (!cleanToken || !cleanToken.includes('.')) {
      // Error ini berarti user mengupload file teks biasa atau file kosong
      throw new BadRequestException('Format file rusak: Token tidak memiliki struktur yang valid.');
    }

    const [payloadBase64, providedSignature] = cleanToken.split('.');

    // 2. Validasi Kelengkapan Bagian
    if (!payloadBase64 || !providedSignature) {
      throw new BadRequestException('Format file rusak: Payload atau Signature hilang.');
    }

    // 3. Re-Calculate Signature (Validasi Integritas)
    // Server menghitung ulang signature berdasarkan Payload + Secret Key Server
    const expectedSignature = this.createHmacSignature(payloadBase64);

    // Gunakan Buffer untuk perbandingan aman (mencegah timing attack)
    const signatureBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    // Cek apakah panjang buffer sama dulu (karena timingSafeEqual akan error jika beda panjang)
    const isValid =
      signatureBuffer.length === expectedBuffer.length &&
      nodeCrypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      // Log detail untuk Admin/Developer memantau masalah
      // Jika ini muncul, berarti:
      // A. File diedit user secara manual
      // B. Server di-redeploy dan RETENTION_SECRET berubah (Lupa set .env)
      this.logger.error(`Import Failed: Signature Mismatch.
        Provided (File): ${providedSignature.substring(0, 10)}...
        Expected (Server): ${expectedSignature.substring(0, 10)}...
        Check RETENTION_SECRET consistency in .env file.`);

      throw new BadRequestException(
        'Validasi Gagal: File telah dimodifikasi atau Kunci Server tidak cocok.',
      );
    }

    // 4. Decode JSON Payload
    try {
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const data = JSON.parse(payloadJson);

      return {
        message: 'File simulasi berhasil di-import.',
        // Mapping data agar struktur konsisten saat diterima Frontend
        data: {
          client: data.client,
          spouse: data.spouse,
          financial: data.financial,
          last_simulation_date: data.meta?.generatedAt || new Date(),
          // Fallback: Support format lama (result) dan baru (financialRatios)
          result: data.result || data.financialRatios,
        },
      };
    } catch (error: any) {
      this.logger.error(`Import Failed: JSON Parse Error. ${error.message}`);
      throw new BadRequestException('Gagal membaca data: Isi file (Payload) rusak/corrupt.');
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
  // MODULE 13: RISK PROFILE SIMULATION (STATELESS & AGENT MODE)
  // ===========================================================================

  async simulateAgentRiskProfile(user: User, dto: CreateRiskProfileSimulationDto) {
    try {
      const analysisResult = calculateRiskProfileAnalysis(dto.answers as any);
      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity || '-',
          clientJob: dto.clientJob || '-',
          totalIncome: 0,
          calculatedSurplus: 0,
          healthScore: analysisResult.totalScore,
          status: HealthStatus.SEHAT,
          financialRatios: {
            profile: analysisResult.profile,
            allocation: analysisResult.allocation
          } as unknown as Prisma.InputJsonValue,
          moduleType: 'RISK_PROFILE',
        },
      });

      const riskProfileResponse: RiskProfileResponseDto = {
        calculatedAt: new Date().toISOString(),
        clientName: dto.clientName,
        clientDob: dto.clientDob,
        totalScore: analysisResult.totalScore,
        riskProfile: analysisResult.profile,
        riskDescription: analysisResult.description,
        allocation: analysisResult.allocation
      };

      const pdfBuffer = await this.pdfService.generateRiskProfileSimulationPdfBuffer(
        dto,
        riskProfileResponse,
        user
      );

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
          answers: dto.answers
        },
        result: analysisResult,
      });

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

  // ===========================================================================
  // MODULE 12: AGENT EDUCATION SIMULATION (STATELESS)
  // ===========================================================================

  async simulateAgentEducation(user: User, dto: CreateEducationSimulationDto) {
    try {
      // 1. ITERATIVE CALCULATION & AGGREGATION
      // [FIX]: Tambahkan tipe ': any[]' agar tidak dianggap 'never[]'
      const simulationResults: any[] = [];

      let totalMonthlyInvestment = 0;
      let totalFutureCostAllChildren = 0;

      // Loop setiap anak yang diinputkan agen
      for (const childPlan of dto.childrenPlans) {
        // Mapping input DTO ke format yang dibutuhkan math engine
        const calculationInput = {
          ...childPlan,
          method: childPlan.method || 'GEOMETRIC',
          inflationRate: childPlan.inflationRate ?? 10,
          returnRate: childPlan.returnRate ?? 12,
        };

        // Panggil Core Math Engine
        const result = calculateEducationPlan(calculationInput as any);

        // Hitung total saving & future cost khusus anak ini
        const childTotalMonthly = result.stagesBreakdown.reduce((acc, stage) => acc + stage.monthlySaving, 0);
        const childTotalFuture = result.stagesBreakdown.reduce((acc, stage) => acc + stage.futureCost, 0);

        // Tambahkan ke Total Keluarga
        totalMonthlyInvestment += childTotalMonthly;
        totalFutureCostAllChildren += childTotalFuture;

        // Push hasil ke array (Sekarang aman karena sudah di-type 'any[]')
        simulationResults.push({
          childName: childPlan.childName,
          childDob: childPlan.childDob,
          summary: {
            totalFutureCost: childTotalFuture,
            totalMonthlySaving: childTotalMonthly
          },
          detail: result
        });
      }

      // 2. LOGGING TO DB
      const clientAge = this.calculateAge(dto.clientDob);

      await this.prisma.simulationLog.create({
        data: {
          agentId: user.id,
          clientAge: clientAge,
          clientCity: dto.clientCity,
          clientJob: dto.clientJob || '-',
          totalIncome: totalFutureCostAllChildren,
          calculatedSurplus: totalMonthlyInvestment,
          healthScore: 100,
          status: HealthStatus.SEHAT,
          moduleType: 'EDUCATION',
          financialRatios: JSON.parse(JSON.stringify(simulationResults)) as Prisma.InputJsonValue,
        },
      });

      // 3. PDF GENERATION
      const pdfBuffer = await this.pdfService.generateEducationSimulationPdf(
        dto,
        simulationResults,
        totalMonthlyInvestment,
        user,
      );

      // 4. MGC TOKEN GENERATION
      const mgcToken = this.generateMgcToken({
        meta: {
          version: '1.0',
          generatedAt: new Date().toISOString(),
          agentId: user.id,
          module: 'EDUCATION',
        },
        client: {
          name: dto.clientName,
          dob: dto.clientDob,
          city: dto.clientCity,
          job: dto.clientJob,
          phone: dto.clientPhone,
        },
        financial: {
          childrenCount: dto.childrenPlans.length,
          existingSaving: dto.currentSaving
        },
        result: {
          totalMonthlyInvestment,
          totalFutureCost: totalFutureCostAllChildren,
          details: simulationResults
        },
      });

      const cleanName = dto.clientName.replace(/[^a-zA-Z0-9]/g, '_');
      return {
        pdfBuffer,
        mgcToken,
        filename: `Education_Plan_${cleanName}_${Date.now()}.pdf`,
      };

    } catch (error: any) {
      this.logger.error(`Education Simulation Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal memproses simulasi pendidikan.');
    }
  }
}