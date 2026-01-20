import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { CreateFinancialRecordDto } from './dto/create-financial-record.dto';
import { calculateFinancialHealth } from './utils/financial-math.util'; // Kita buat setelah ini
import { HealthStatus } from '@prisma/client';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // ===========================================================================
  // MODULE 1: FINANCIAL CHECKUP (The "Medical" Check)
  // ===========================================================================

  async createCheckup(userId: string, dto: CreateFinancialRecordDto) {
    // 1. Hitung Ulang (Re-calculate) di Backend
    // Kita tidak percaya 100% data olahan FE. Raw data dari DTO dihitung ulang
    // menggunakan logic engine yang sama dengan FE untuk konsistensi.
    const analysis = calculateFinancialHealth(dto);

    // 2. Mapping Status String ke Enum Prisma
    // FE mengirim string "SEHAT" | "WASPADA" | "BAHAYA", kita cast ke Enum Prisma
    let dbStatus: HealthStatus = HealthStatus.BAHAYA;
    if (analysis.globalStatus === 'SEHAT') dbStatus = HealthStatus.SEHAT;
    else if (analysis.globalStatus === 'WASPADA') dbStatus = HealthStatus.WASPADA;

    // 3. Simpan ke Database
    // Kita menyimpan Input Mentah (DTO) + Hasil Analisa (Analysis)
    return this.prisma.financialCheckup.create({
      data: {
        userId,
        
        // --- A. SIMPAN DATA INPUT MENTAH (SPREAD DTO) ---
        // Karena struktur DTO dan Prisma Model sudah dibuat mirroring 1:1,
        // kita bisa menggunakan spread operator untuk efisiensi code.
        // Prisma akan otomatis memetakan field seperti assetCash, debtKPR, dll.
        ...dto,

        // Khusus Field JSON (Profil), kita pastikan casting-nya aman
        userProfile: dto.userProfile as any,
        spouseProfile: dto.spouseProfile ? (dto.spouseProfile as any) : undefined,

        // --- B. SIMPAN HASIL PERHITUNGAN BACKEND ---
        totalNetWorth: analysis.netWorth,
        surplusDeficit: analysis.surplusDeficit,
        healthScore: analysis.score,
        status: dbStatus,
        
        // Detail 8 Rasio disimpan sebagai JSON agar frontend bisa render ulang
        // tanpa perlu menghitung ulang jika hanya view history
        ratiosDetails: analysis.ratios as any, 
      },
    });
  }

  async getLatestCheckup(userId: string) {
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
        totalNetWorth: true, // Untuk grafik history kekayaan
      },
    });
  }

  // ===========================================================================
  // MODULE 2: BUDGET PLAN (The "Monthly" Plan) - KEEP EXISTING LOGIC
  // ===========================================================================
  
  async createBudget(userId: string, dto: CreateBudgetDto) {
    // 1. Hitung Total & Balance
    const totalIncome = dto.fixedIncome + dto.variableIncome;
    const totalExpense =
      dto.productiveDebt +
      dto.consumptiveDebt +
      dto.insurance +
      dto.saving +
      dto.livingCost;
    
    const balance = totalIncome - totalExpense;

    // 2. Tentukan Status Cashflow Dasar
    let cashflowStatus = 'BALANCED';
    if (balance < 0) cashflowStatus = 'DEFISIT';
    if (balance > 0) cashflowStatus = 'SURPLUS';

    // 3. Simpan Rincian Anggaran ke DB
    return this.prisma.$transaction(async (tx) => {
      // A. Simpan Budget Plan
      const budget = await tx.budgetPlan.create({
        data: {
          userId,
          month: dto.month,
          year: dto.year,
          fixedIncome: dto.fixedIncome,
          variableIncome: dto.variableIncome,
          productiveDebt: dto.productiveDebt,
          consumptiveDebt: dto.consumptiveDebt,
          insurance: dto.insurance,
          saving: dto.saving,
          livingCost: dto.livingCost,
          totalIncome,
          totalExpense,
          balance,
          status: cashflowStatus,
        },
      });

      // B. Jalankan Analisa Kesehatan Sederhana (Khusus Budgeting)
      const analysis = this.analyzeBudgetHealth(dto);

      // Note: Di fitur Budgeting, kita mungkin tidak perlu simpan ke tabel FinancialCheckup
      // karena FinancialCheckup sekarang strukturnya sangat detail (Medical Check).
      // Budgeting lebih ke operational bulanan. 
      
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

  // --- LOGIKA 5 POS ANGGARAN (Simple Logic for Budgeting) ---
  private analyzeBudgetHealth(dto: CreateBudgetDto) {
    let score = 100;
    const violations: string[] = [];
    const base = Number(dto.fixedIncome); 

    if (base === 0) {
      return { score: 0, status: 'BAHAYA', recommendation: 'Wajib input Gaji Tetap untuk analisa.' };
    }

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
    if (violations.length > 0) {
      recommendation = `Perbaiki: ${violations.join(', ')}.`;
    }

    return { score, status, recommendation };
  }
}