import { Injectable, Logger } from '@nestjs/common';
import { CreateInsuranceDto } from '../dto/create-insurance.dto';

// Interface untuk Output JSON yang rapi
export interface InsuranceCalculationResult {
    financials: {
        needs: {
            income_replacement: number;
            debt_clearance: number;
            final_expenses: number;
            education_fund: number;
            total_needs: number;
        };
        resources: {
            liquid_assets: number;
            existing_policy: number;
            total_resources: number;
        };
        gap: number; // Kekurangan yang harus dipenuhi (Proteksi Tambahan)
    };
    analysis: {
        health_score: number; // 0-100
        coverage_ratio: number; // Persentase kebutuhan yang terpenuhi
        status: 'CRITICAL' | 'WARNING' | 'HEALTHY';
        recommendation: string;
    };
    meta: {
        calculated_at: string;
        inflation_rate_used: number;
        investment_rate_used: number;
    };
}

@Injectable()
export class InsuranceService {
    private readonly logger = new Logger(InsuranceService.name);

    /**
     * STATELESS ENGINE: Insurance Needs Analysis
     * Menghitung kebutuhan Uang Pertanggungan (UP) Jiwa.
     * Metode: Needs Analysis (Income Replacement + Liabilities Clearance).
     */
    calculateInsurance(dto: CreateInsuranceDto): InsuranceCalculationResult {
        this.logger.debug('Calculating Insurance Needs (Stateless Mode)...');

        // =========================================================================
        // 1. EXTRACTION & PARSING (Input Sanitization)
        // =========================================================================

        // A. Tanggungan & Kewajiban (Liabilities)
        const sisaHutang = Number(dto.sisaHutang) || 0; // Sisa KPR, KPM, CC, dll
        const biayaPemakaman = Number(dto.biayaPemakaman) || 0; // Biaya duka
        const estimasiPajak = Number(dto.estimasiPajak) || 0; // BPHTB Waris, Biaya Balik Nama, dll
        const biayaPendidikan = Number(dto.biayaPendidikan) || 0; // Dana pendidikan anak (Lumpsum needed now)

        // B. Income Replacement (Biaya Hidup Keluarga)
        const biayaHidupSurvivor = Number(dto.biayaHidupSurvivor) || 0; // Biaya hidup per bulan
        const proteksiTahun = Number(dto.proteksiTahun) || 10; // Berapa tahun keluarga dilindungi?

        // C. Asumsi Ekonomi
        const inflasiRate = Number(dto.inflasiRate) || 5; // % Inflasi tahunan
        const investasiRate = Number(dto.investasiRate) || 6; // % Return investasi (Low Risk untuk UP Jiwa)

        // D. Aset yang Sudah Ada (Existing Resources)
        const asetLikuid = Number(dto.asetLikuid) || 0; // Deposito, Emas, Tabungan (Bukan Rumah/Mobil)
        const asuransiExisting = Number(dto.asuransiExisting) || 0; // Total UP polis lama

        // =========================================================================
        // 2. CORE CALCULATION LOGIC
        // =========================================================================

        // --- STEP A: Hitung Income Replacement (Present Value) ---
        // Rumus: Menghitung nilai tunai yang harus disiapkan SAAT INI agar
        // keluarga bisa menarik gaji bulanan sebesar 'biayaHidupSurvivor' selama 'proteksiTahun'.

        const rInflation = inflasiRate / 100;
        const rInvest = investasiRate / 100;

        // Real Rate of Return (Tingkat bunga riil setelah inflasi)
        // Rumus Fisher: (1 + i) / (1 + r) - 1
        const realRate = (1 + rInvest) / (1 + rInflation) - 1;

        let incomeReplacementNeed = 0;

        if (biayaHidupSurvivor > 0) {
            if (Math.abs(realRate) < 0.0001) {
                // Jika Real Rate ~ 0%, hitungan linear sederhana
                incomeReplacementNeed = biayaHidupSurvivor * 12 * proteksiTahun;
            } else {
                // Rumus PV of Annuity Due (Asumsi penarikan di awal periode/bulan)
                // PV = PMT * [ (1 - (1+r)^-n) / r ] * (1+r) -> jika tahunan
                // Kita simplifikasi ke tahunan: Expense * 12
                const annualExpense = biayaHidupSurvivor * 12;
                const n = proteksiTahun;

                incomeReplacementNeed = annualExpense * ((1 - Math.pow(1 + realRate, -n)) / realRate);

                // Adjustment factor (karena biaya hidup naik seiring inflasi, tapi uang investasi juga tumbuh)
                // Rumus di atas sudah mengakomodir Real Rate.
            }
        }

        // --- STEP B: Total Needs (Total Kebutuhan Cash) ---
        const finalExpenses = biayaPemakaman + estimasiPajak;
        const totalNeeds =
            sisaHutang +
            finalExpenses +
            biayaPendidikan +
            incomeReplacementNeed;

        // --- STEP C: Total Resources (Total Aset Tersedia) ---
        const totalResources = asetLikuid + asuransiExisting;

        // --- STEP D: Gap Analysis ---
        // Jika Resources > Needs, maka Gap = 0 (Surplus)
        const protectionGap = Math.max(0, totalNeeds - totalResources);

        // =========================================================================
        // 3. SCORING & RECOMMENDATION
        // =========================================================================

        // Coverage Ratio: Seberapa persen kebutuhan tertutup?
        const coverageRatio = totalNeeds > 0
            ? (totalResources / totalNeeds) * 100
            : 100; // Jika kebutuhan 0, maka coverage 100%

        let healthScore = 0;
        let status: InsuranceCalculationResult['analysis']['status'] = 'CRITICAL';
        let recommendation = '';

        if (coverageRatio >= 100) {
            healthScore = 100;
            status = 'HEALTHY';
            recommendation = 'Selamat! Klien memiliki perlindungan yang sangat baik (Surplus). Tidak ada kebutuhan mendesak untuk menambah polis jiwa, kecuali untuk tujuan warisan (Legacy Planning).';
        } else if (coverageRatio >= 80) {
            healthScore = 80;
            status = 'HEALTHY';
            recommendation = 'Kondisi perlindungan sudah cukup baik. Klien terlindungi hampir sepenuhnya. Pertimbangkan penambahan sedikit UP atau rider penyakit kritis untuk menutup celah kecil.';
        } else if (coverageRatio >= 50) {
            healthScore = 50;
            status = 'WARNING';
            recommendation = `Klien baru terlindungi ${coverageRatio.toFixed(0)}%. Terdapat risiko finansial jika terjadi musibah. Prioritaskan penutupan Sisa Hutang terlebih dahulu.`;
        } else {
            healthScore = 20;
            status = 'CRITICAL';
            recommendation = 'BAHAYA: Klien sangat kurang terlindungi (Underinsured). Keluarga berisiko tinggi mengalami kesulitan finansial drastis. SANGAT DISARANKAN untuk segera mengambil asuransi jiwa (Term Life) untuk menutupi Gap minimal sebesar hutang berjalan.';
        }

        // =========================================================================
        // 4. CONSTRUCT OUTPUT
        // =========================================================================

        return {
            financials: {
                needs: {
                    income_replacement: Math.round(incomeReplacementNeed),
                    debt_clearance: sisaHutang,
                    final_expenses: finalExpenses,
                    education_fund: biayaPendidikan,
                    total_needs: Math.round(totalNeeds),
                },
                resources: {
                    liquid_assets: asetLikuid,
                    existing_policy: asuransiExisting,
                    total_resources: Math.round(totalResources),
                },
                gap: Math.round(protectionGap),
            },
            analysis: {
                health_score: healthScore,
                coverage_ratio: Number(coverageRatio.toFixed(2)),
                status,
                recommendation,
            },
            meta: {
                calculated_at: new Date().toISOString(),
                inflation_rate_used: inflasiRate,
                investment_rate_used: investasiRate,
            },
        };
    }
}