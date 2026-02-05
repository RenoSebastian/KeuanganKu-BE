import { Injectable, Logger } from '@nestjs/common';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { BudgetResult } from '../interfaces/budget-result.interface';

@Injectable()
export class BudgetService {
    private readonly logger = new Logger(BudgetService.name);

    /**
     * STATELESS CALCULATION ENGINE
     * * Fungsi ini murni matematis. 
     * Menerima DTO (Angka) -> Mengembalikan Result (Analisis).
     * TIDAK menyimpan data ke database untuk menjaga privasi klien (Local-First Architecture).
     */
    calculateBudget(dto: CreateBudgetDto): BudgetResult {
        this.logger.debug('Calculating budget in stateless mode...');

        // 1. Ekstraksi & Sanitasi Input (Pastikan number)
        const fixedIncome = Number(dto.fixedIncome) || 0;
        const variableIncome = Number(dto.variableIncome) || 0;
        const totalIncome = fixedIncome + variableIncome;

        const livingCost = Number(dto.livingCost) || 0;
        const productiveDebt = Number(dto.productiveDebt) || 0;
        const consumptiveDebt = Number(dto.consumptiveDebt) || 0;
        const insurance = Number(dto.insurance) || 0;
        const saving = Number(dto.saving) || 0;

        // 2. Kalkulasi Pengeluaran & Alokasi
        const totalDebt = productiveDebt + consumptiveDebt;

        // Total Allocation = Semua uang yang 'keluar' dari dompet utama, 
        // termasuk tabungan (karena dipindah ke pos lain)
        const totalAllocation = livingCost + totalDebt + insurance + saving;

        // 3. Kalkulasi Cashflow (Surplus/Defisit)
        const balance = totalIncome - totalAllocation;

        // 4. Kalkulasi Rasio Finansial
        // Savings Ratio: Berapa persen income yang ditabung?
        const savingsRatio = totalIncome > 0
            ? (saving / totalIncome) * 100
            : 0;

        // Debt Service Ratio: Berapa persen income untuk bayar utang?
        const debtRatio = totalIncome > 0
            ? (totalDebt / totalIncome) * 100
            : 0;

        // 5. Algoritma Health Score (0-100)
        let score = 0;

        // A. Cashflow Check (Bobot 40)
        if (balance >= 0) {
            score += 40;
        } else {
            // Jika defisitnya kecil (< 10% income), masih dapat poin dikit
            if (Math.abs(balance) < (totalIncome * 0.1)) score += 20;
        }

        // B. Savings Check (Bobot 20)
        if (savingsRatio >= 20) score += 20;
        else if (savingsRatio >= 10) score += 10;
        else if (savingsRatio > 0) score += 5;

        // C. Debt Check (Bobot 20)
        if (debtRatio === 0) score += 20;
        else if (debtRatio <= 30) score += 20; // Sehat
        else if (debtRatio <= 40) score += 10; // Waspada
        else score += 0; // Bahaya (>40%)

        // D. Protection Check (Bobot 20)
        if (insurance > 0) {
            // Asumsi sederhana: jika ada alokasi asuransi, dapat poin
            // Di real case bisa dicek rasionya terhadap income (ideal 5-10%)
            score += 20;
        }

        // 6. Tentukan Status & Rekomendasi
        let status: BudgetResult['analysis']['status'] = 'DANGER';
        let recommendation = '';

        if (score >= 80) {
            status = 'HEALTHY';
            recommendation = 'Kondisi keuangan klien SANGAT SEHAT. Arus kas positif, utang terkendali, dan memiliki tabungan serta proteksi. Sarankan diversifikasi investasi untuk pertumbuhan aset.';
        } else if (score >= 50) {
            status = 'WARNING';
            recommendation = 'Kondisi keuangan CUKUP STABIL, namun perlu perbaikan. Fokuskan pada peningkatan rasio tabungan (min. 10%) atau pelunasan utang konsumtif jika rasio utang mendekati 35%.';
        } else {
            status = 'DANGER';
            recommendation = 'Kondisi keuangan KRITIS (Cashflow negatif atau utang tinggi). Prioritas utama adalah menekan biaya hidup (Living Cost) dan stop utang baru. Lakukan restrukturisasi keuangan segera.';
        }

        // 7. Construct Output
        return {
            meta: {
                module: 'BUDGETING',
                version: '1.0',
                generated_at: new Date().toISOString(),
            },
            financials: {
                income: {
                    fixed: fixedIncome,
                    variable: variableIncome,
                    total: totalIncome,
                },
                expense: {
                    living_cost: livingCost,
                    debt_total: totalDebt,
                    insurance: insurance,
                    saving: saving,
                    total_allocation: totalAllocation,
                },
                balance: balance,
            },
            analysis: {
                health_score: score,
                ratios: {
                    savings_ratio: Number(savingsRatio.toFixed(2)),
                    debt_service_ratio: Number(debtRatio.toFixed(2)),
                },
                status: status,
                recommendation: recommendation,
            },
        };
    }
}