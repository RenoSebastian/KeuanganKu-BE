import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // --- MAIN FUNCTION: SIMPAN & ANALISA ---
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
    // Menggunakan transaction agar data konsisten
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

      // B. Jalankan Analisa Kesehatan (AI Logic Sederhana)
      const analysis = this.analyzeHealth(dto);

      // C. Simpan Hasil Checkup
      const checkup = await tx.financialCheckup.create({
        data: {
          userId,
          incomeSnapshot: totalIncome,
          expenseSnapshot: totalExpense,
          score: analysis.score,
          status: analysis.status,
          recommendation: analysis.recommendation,
        },
      });

      return { budget, checkup };
    });
  }

  // --- LOGIKA 5 POS ANGGARAN (The Brain) ---
  private analyzeHealth(dto: CreateBudgetDto) {
    let score = 100;
    const violations: string[] = [];
    const base = dto.fixedIncome; // Rumus berdasarkan Gaji Tetap

    // Jika gaji 0, otomatis gagal
    if (base === 0) {
      return { score: 0, status: 'BAHAYA', recommendation: 'Wajib input Gaji Tetap untuk analisa.' };
    }

    // Rule 1: Hutang Produktif Max 20%
    if (dto.productiveDebt > base * 0.2) {
      score -= 10;
      violations.push('Hutang Produktif melebihi 20%');
    }

    // Rule 2: Hutang Konsumtif Max 15%
    if (dto.consumptiveDebt > base * 0.15) {
      score -= 20; // Hukuman lebih berat
      violations.push('Hutang Konsumtif melebihi 15%');
    }

    // Rule 3: Asuransi Min 10%
    if (dto.insurance < base * 0.1) {
      score -= 10;
      violations.push('Asuransi kurang dari 10%');
    }

    // Rule 4: Tabungan Min 10%
    if (dto.saving < base * 0.1) {
      score -= 20; // Hukuman berat, menabung itu wajib!
      violations.push('Tabungan kurang dari 10%');
    }

    // Rule 5: Biaya Hidup Max 45% (Hanya indikator, hukuman ringan)
    if (dto.livingCost > base * 0.45) {
      score -= 10;
      violations.push('Biaya Hidup boros (>45%)');
    }

    // Cek Defisit (Fatal)
    const totalExpense = dto.productiveDebt + dto.consumptiveDebt + dto.insurance + dto.saving + dto.livingCost;
    if (totalExpense > (dto.fixedIncome + dto.variableIncome)) {
      score -= 30;
      violations.push('CASHFLOW DEFISIT! Besar pasak daripada tiang');
    }

    // Normalisasi Score (Min 0)
    if (score < 0) score = 0;

    // Tentukan Status Label
    let status = 'SEHAT';
    if (score < 80) status = 'WASPADA';
    if (score < 60) status = 'BAHAYA';

    // Generate Rekomendasi
    let recommendation = 'Kondisi keuangan Anda sangat prima. Pertahankan!';
    if (violations.length > 0) {
      recommendation = `Perhatian: ${violations.join(', ')}. Segera atur ulang pos pengeluaran Anda.`;
    }

    return { score, status, recommendation };
  }

  // --- FITUR TAMBAHAN: GET HISTORY ---
  async getMyBudgets(userId: string) {
    return this.prisma.budgetPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12, // Ambil 12 bulan terakhir
    });
  }

  async getLatestCheckup(userId: string) {
    return this.prisma.financialCheckup.findFirst({
      where: { userId },
      orderBy: { checkDate: 'desc' },
    });
  }
}