import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto, SimulateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';
import { SchoolLevel, CostType, HealthStatus } from '@prisma/client';
import {
  calculateFinancialHealth,
  calculatePensionPlan,
  calculateInsurancePlan,
  calculateGoalPlan,
  calculateGoalSimulation,
  calculateEducationPlan,
  calculateBudgetSplit,
} from './utils/financial-math.util';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) { }

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (The "Medical" Check)
  // ===========================================================================

  async createCheckup(userId: string, dto: CreateFinancialRecordDto) {
    // 1. Hitung Ulang (Re-calculate) menggunakan Math Utility
    const analysis = calculateFinancialHealth(dto);

    // 2. Mapping Status String dari Utility ke Enum Prisma
    let dbStatus: HealthStatus = HealthStatus.BAHAYA;
    if (analysis.globalStatus === 'SEHAT') dbStatus = HealthStatus.SEHAT;
    else if (analysis.globalStatus === 'WASPADA') dbStatus = HealthStatus.WASPADA;

    // 3. Simpan ke Database
    return this.prisma.financialCheckup.create({
      data: {
        userId,
        ...dto,
        // Mapping manual karena Prisma tidak otomatis map sub-object JSON
        userProfile: dto.userProfile as any,
        spouseProfile: dto.spouseProfile ? (dto.spouseProfile as any) : undefined,

        // Simpan Hasil Analisa (Persistence Optimization)
        totalNetWorth: analysis.netWorth,
        surplusDeficit: analysis.surplusDeficit,
        healthScore: analysis.score,
        status: dbStatus,
        ratiosDetails: analysis.ratios as any, // Simpan detail rasio sebagai JSON
      },
    });
  }

  // [UPDATED] Method ini Public & Exported untuk dipakai DirectorService
  // Phase 1 Fix: Mapping ratiosDetails -> ratios & Kalkulasi Agregat
  async getLatestCheckup(userId: string, actorRole?: string) {
    const checkup = await this.prisma.financialCheckup.findFirst({
      where: { userId },
      orderBy: { checkDate: 'desc' },
    });

    if (!checkup) return null;

    // --- AGGREGATION LOGIC (Hitung ulang total kategori) ---
    // Helper untuk konversi Decimal/null ke Number
    const val = (n: any) => Number(n) || 0;

    // 1. Total Asset Investasi
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

    // 2. Total Hutang Konsumtif
    const debtConsumptive =
      val(checkup.debtKPR) +
      val(checkup.debtKPM) +
      val(checkup.debtCC) +
      val(checkup.debtCoop) +
      val(checkup.debtConsumptiveOther);

    // 3. Total Hutang Produktif
    const debtProductive = val(checkup.debtBusiness);

    // 4. Total Pemasukan Bulanan
    const incomeMonthly = val(checkup.incomeFixed) + val(checkup.incomeVariable);

    // 5. Total Pengeluaran Bulanan (Cicilan + Asuransi + Tabungan + Biaya Hidup)
    const expenseMonthly =
      // Installments
      val(checkup.installmentKPR) +
      val(checkup.installmentKPM) +
      val(checkup.installmentCC) +
      val(checkup.installmentCoop) +
      val(checkup.installmentConsumptiveOther) +
      val(checkup.installmentBusiness) +
      // Insurance
      val(checkup.insuranceLife) +
      val(checkup.insuranceHealth) +
      val(checkup.insuranceHome) +
      val(checkup.insuranceVehicle) +
      val(checkup.insuranceBPJS) +
      val(checkup.insuranceOther) +
      // Savings
      val(checkup.savingEducation) +
      val(checkup.savingRetirement) +
      val(checkup.savingPilgrimage) +
      val(checkup.savingHoliday) +
      val(checkup.savingEmergency) +
      val(checkup.savingOther) +
      // Living Cost
      val(checkup.expenseFood) +
      val(checkup.expenseSchool) +
      val(checkup.expenseTransport) +
      val(checkup.expenseCommunication) +
      val(checkup.expenseHelpers) +
      val(checkup.expenseTax) +
      val(checkup.expenseLifestyle);

    // Transformasi Data Manual (Data Mapping Layer)
    return {
      ...checkup,

      // [CRITICAL FIX] Mapping field DB 'ratiosDetails' ke field FE 'ratios'
      ratios: checkup.ratiosDetails,

      // [CRITICAL FIX] Mengirimkan data agregat yang dihitung di atas
      assetInvestment,
      debtConsumptive,
      debtProductive,
      incomeMonthly,
      expenseMonthly,

      // Data Cleaning: Convert Decimal (Prisma) ke Number (JS)
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

  // [NEW] Method untuk Mengambil Detail Checkup Spesifik (Roadmap Part 1)
  async getCheckupDetail(userId: string, checkupId: string) {
    const checkup = await this.prisma.financialCheckup.findFirst({
      where: { id: checkupId, userId },
    });

    if (!checkup) {
      throw new NotFoundException('Data checkup tidak ditemukan');
    }

    // Return objek bersih (Clean Object) untuk Frontend
    return {
      score: checkup.healthScore,
      globalStatus: checkup.status,
      netWorth: Number(checkup.totalNetWorth),
      surplusDeficit: Number(checkup.surplusDeficit),
      ratios: checkup.ratiosDetails, // Mengembalikan JSON detail rasio
      generatedAt: checkup.checkDate.toISOString(),
      record: {
        ...checkup,
        assetCash: Number(checkup.assetCash),
        totalNetWorth: Number(checkup.totalNetWorth),
        surplusDeficit: Number(checkup.surplusDeficit),
      }
    };
  }

  // ===========================================================================
  // MODULE 2: BUDGET PLAN (The "Monthly" Plan)
  // ===========================================================================

  async createBudget(userId: string, dto: CreateBudgetDto) {
    const totalIncome = dto.fixedIncome + dto.variableIncome;

    // --- LOGIKA CERDAS: AUTO-CALCULATE JIKA KOSONG ---
    const isManualInput = dto.livingCost && dto.livingCost > 0;

    let finalAllocation = {
      livingCost: dto.livingCost || 0,
      productiveDebt: dto.productiveDebt || 0,
      consumptiveDebt: dto.consumptiveDebt || 0,
      insurance: dto.insurance || 0,
      saving: dto.saving || 0,
    };

    if (!isManualInput) {
      // Jika kosong, panggil otak matematika Phase 2
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
          // Gunakan hasil finalAllocation (bisa manual atau auto-calculate)
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

      // Jalankan analisa kesehatan berdasarkan data yang sudah lengkap
      const analysis = this.analyzeBudgetHealth({
        ...dto,
        ...finalAllocation
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
  // MODULE 3: CALCULATOR - PENSION PLAN (UPDATED LOGIC)
  // ===========================================================================

  async calculateAndSavePension(userId: string, dto: CreatePensionDto) {
    // 1. Hitung Logika Pensiun (Future Value & PMT)
    const result = calculatePensionPlan(dto);

    // 2. Simpan Rencana ke Database
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

        // Hasil Perhitungan
        totalFundNeeded: result.totalFundNeeded,
        monthlySaving: result.monthlySaving,
      },
    });

    return { plan, calculation: result };
  }

  // ===========================================================================
  // MODULE 4: CALCULATOR - INSURANCE PLAN (UPDATED LOGIC)
  // ===========================================================================

  async calculateAndSaveInsurance(userId: string, dto: CreateInsuranceDto) {
    // 1. Hitung Kebutuhan UP
    const result = calculateInsurancePlan(dto);

    // 2. Simpan Rencana
    const plan = await this.prisma.insurancePlan.create({
      data: {
        userId,
        type: dto.type,
        dependentCount: dto.dependentCount,
        monthlyExpense: dto.monthlyExpense,
        existingDebt: dto.existingDebt,
        existingCoverage: dto.existingCoverage,
        protectionDuration: dto.protectionDuration,

        // Hasil Perhitungan
        coverageNeeded: result.totalNeeded,
        recommendation: result.recommendation,
      },
    });

    return { plan, calculation: result };
  }

  // ===========================================================================
  // MODULE 5: CALCULATOR - GOAL PLAN (NEW)
  // ===========================================================================

  // Method 1: CALCULATE ONLY (Simulasi Cepat) - Tidak Masuk DB
  simulateGoal(userId: string, dto: SimulateGoalDto) {
    // Panggil utility math murni
    const result = calculateGoalSimulation(dto);

    return {
      status: 'success',
      data: result // { futureValue, monthlySaving }
    };
  }

  // Method 2: CALCULATE & SAVE (Simpan Rencana)
  async calculateAndSaveGoal(userId: string, dto: CreateGoalDto) {
    // 1. Hitung PMT Goal (Logic CreateGoalDto basis targetAmount)
    const result = calculateGoalPlan(dto);

    // 2. Simpan Rencana
    const plan = await this.prisma.goalPlan.create({
      data: {
        userId,
        goalName: dto.goalName,
        targetAmount: dto.targetAmount,
        targetDate: new Date(dto.targetDate),
        inflationRate: dto.inflationRate,
        returnRate: dto.returnRate,

        // Hasil Perhitungan
        futureValue: result.futureTargetAmount,
        monthlySaving: result.monthlySaving,
      },
    });

    return { plan, calculation: result };
  }

  // ===========================================================================
  // MODULE 6: CALCULATOR - EDUCATION PLAN (GRANULAR UPDATE)
  // ===========================================================================

  async calculateAndSaveEducation(userId: string, dto: CreateEducationPlanDto) {
    // 1. Hitung FV & PMT Pendidikan (Granular Sinking Fund)
    const result = calculateEducationPlan(dto);

    // 2. Simpan Parent Plan & Child Stages (Transaction)
    const savedData = await this.prisma.$transaction(async (tx) => {
      // A. Create Header Plan
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

      // B. Create Detail Stages (TK, SD, SMP...)
      const stagesData = result.stagesBreakdown.map((stage) => {
        // --- DATA TRANSFORMATION LOGIC ---
        let dbLevel: SchoolLevel = stage.level;

        //Cek jika level dikirim sebagai string yang perlu di konversi
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

          // FIELD PENTING: Hasil Hitungan Backend
          futureCost: stage.futureCost,        // FV Item Ini
          monthlySaving: stage.monthlySaving,  // Tabungan Item Ini
        };
      });

      await tx.educationStage.createMany({
        data: stagesData,
      });

      return plan;
    });

    return { plan: savedData, calculation: result };
  }


  // --- PRIVATE HELPERS ---
  private analyzeBudgetHealth(dto: CreateBudgetDto) {
    let score = 100;
    const violations: string[] = [];
    const base = Number(dto.fixedIncome);

    if (base === 0) return { score: 0, status: 'BAHAYA', recommendation: 'Wajib input Gaji Tetap.' };

    if (Number(dto.productiveDebt) > base * 0.2) { score -= 10; violations.push('Hutang Produktif > 20%'); }
    if (Number(dto.consumptiveDebt) > base * 0.15) { score -= 20; violations.push('Hutang Konsumtif > 15%'); }
    if (Number(dto.insurance) < base * 0.1) { score -= 10; violations.push('Asuransi < 10%'); }
    if (Number(dto.saving) < base * 0.1) { score -= 20; violations.push('Tabungan < 10%'); }

    const totalExpense = Number(dto.productiveDebt) + Number(dto.consumptiveDebt) + Number(dto.insurance) + Number(dto.saving) + Number(dto.livingCost);
    if (totalExpense > (Number(dto.fixedIncome) + Number(dto.variableIncome))) {
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

  // --- METHODS UNTUK MANAJEMEN RENCANA PENDIDIKAN ---

  async getEducationPlans(userId: string) {
    const plans = await this.prisma.educationPlan.findMany({
      where: { userId },
      include: {
        stages: true,
      },
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

    if (!plan) {
      throw new NotFoundException('Rencana pendidikan tidak ditemukan');
    }

    return this.prisma.educationPlan.delete({
      where: { id: planId },
    });
  }
}