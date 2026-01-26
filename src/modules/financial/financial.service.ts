import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { CreatePensionDto } from './dto/create-pension.dto';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateEducationPlanDto } from './dto/create-education.dto';
import { 
  calculateFinancialHealth,
  calculatePensionPlan,
  calculateInsurancePlan,
  calculateGoalPlan,
  calculateEducationPlan,
  calculateBudgetSplit,
} from './utils/financial-math.util';
import { HealthStatus } from '@prisma/client';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (The "Medical" Check)
  // ===========================================================================

  async createCheckup(userId: string, dto: CreateFinancialRecordDto) {
    // 1. Hitung Ulang (Re-calculate) menggunakan Math Utility
    // Ini menjamin data yang masuk DB sudah "matang" (ada score, status, rasio)
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

  // [IMPORTANT] Method ini Public & Exported untuk dipakai DirectorService
  // Refactor: Menambahkan parameter actorRole untuk skalabilitas filtering akses
  async getLatestCheckup(userId: string, actorRole?: string) {
    // Saat ini logicnya masih mengambil full data
    // Parameter actorRole disiapkan jika nanti ada kebutuhan filtering field di level database
    return this.prisma.financialCheckup.findFirst({
      where: { userId },
      orderBy: { checkDate: 'desc' },
    });
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

  // ===========================================================================
  // MODULE 2: BUDGET PLAN (The "Monthly" Plan)
  // ===========================================================================
  
  async createBudget(userId: string, dto: CreateBudgetDto) {
    const totalIncome = dto.fixedIncome + dto.variableIncome;

    // --- LOGIKA CERDAS: AUTO-CALCULATE JIKA KOSONG ---
    // Cek jika field utama pengeluaran tidak dikirim atau nol
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

  async calculateAndSaveGoal(userId: string, dto: CreateGoalDto) {
    // 1. Hitung PMT Goal
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
      // Kita map hasil perhitungan utils ke struktur database
      // stagesBreakdown sudah berisi futureCost dan monthlySaving per item
      const stagesData = result.stagesBreakdown.map((stage) => ({
        planId: plan.id,
        level: stage.level,
        costType: stage.costType,
        currentCost: stage.currentCost,
        yearsToStart: stage.yearsToStart,
        
        // FIELD PENTING: Hasil Hitungan Backend
        futureCost: stage.futureCost,        // FV Item Ini
        monthlySaving: stage.monthlySaving,  // Tabungan Item Ini
      }));

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
    // 1. Ambil data mentah dari DB (Header + Detail Stages)
    const plans = await this.prisma.educationPlan.findMany({
      where: { userId },
      include: {
        stages: true, // Ambil relation stages
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Transformasi ke format Response yang diharapkan Frontend
    return plans.map((p) => {
      const { stages, ...planData } = p;

      // Hitung total untuk kelengkapan data calculation
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
    // Cek kepemilikan
    const plan = await this.prisma.educationPlan.findFirst({
      where: { id: planId, userId },
    });

    if (!plan) {
      throw new NotFoundException('Rencana pendidikan tidak ditemukan');
    }

    // Hapus Plan
    return this.prisma.educationPlan.delete({
      where: { id: planId },
    });
  }
}