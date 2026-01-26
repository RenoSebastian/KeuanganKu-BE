import { CreateFinancialRecordDto } from '../dto/create-financial-record.dto';
import { CreatePensionDto } from '../dto/create-pension.dto';
import { CreateInsuranceDto } from '../dto/create-insurance.dto';
import { CreateGoalDto } from '../dto/create-goal.dto';
import { CreateEducationPlanDto } from '../dto/create-education.dto';

// --- INTERFACES (Mirroring FE logic) ---
export interface RatioDetail {
  id: string;
  label: string;
  value: number;
  benchmark: string;
  statusColor: 'GREEN_DARK' | 'GREEN_LIGHT' | 'YELLOW' | 'RED';
  recommendation: string;
  status?: string;
}

export interface HealthAnalysisResult {
  score: number;
  globalStatus: 'SEHAT' | 'WASPADA' | 'BAHAYA';
  ratios: RatioDetail[];
  netWorth: number; // H. Kekayaan Bersih
  surplusDeficit: number; // Q. Surplus/Defisit
  generatedAt: string;
  // Feedback data raw untuk Frontend (opsional)
  incomeFixed?: number;
  incomeVariable?: number;
}

// ============================================================================
// 1. FINANCIAL HEALTH CHECK UP ENGINE
// ============================================================================

export const calculateFinancialHealth = (
  data: CreateFinancialRecordDto,
): HealthAnalysisResult => {
  // --- 1. AGGREGATION (PENGGABUNGAN DATA) ---

  // Helper untuk memastikan angka valid (prevent NaN)
  const val = (n: number) => Number(n) || 0;

  // NOTE: Sesuai kesepakatan, SEMUA data arus kas (Flow) dari Frontend 
  // dikirim dalam satuan BULANAN. Backend akan mengalikan 12 untuk hitungan tahunan.

  // --- A. TOTAL ASET (STOCK - Tetap/Snapshot) ---
  const totalLiquid = val(data.assetCash); // A. Aset Likuid

  // Aset Personal (B)
  const totalPersonal =
    val(data.assetHome) +
    val(data.assetVehicle) +
    val(data.assetJewelry) +
    val(data.assetAntique) +
    val(data.assetPersonalOther);

  // Aset Investasi (C)
  const totalInvestment =
    val(data.assetInvHome) +
    val(data.assetInvVehicle) +
    val(data.assetGold) +
    val(data.assetInvAntique) +
    val(data.assetStocks) +
    val(data.assetMutualFund) +
    val(data.assetBonds) +
    val(data.assetDeposit) +
    val(data.assetInvOther);

  // Total Aset (D)
  const totalAssets = totalLiquid + totalPersonal + totalInvestment;

  // --- B. TOTAL UTANG (STOCK - Tetap/Snapshot) ---
  // Utang Konsumtif (E)
  const totalConsumptiveDebt =
    val(data.debtKPR) +
    val(data.debtKPM) +
    val(data.debtCC) +
    val(data.debtCoop) +
    val(data.debtConsumptiveOther);

  // Utang Usaha (F)
  const totalBusinessDebt = val(data.debtBusiness);

  // Total Utang (G)
  const totalDebt = totalConsumptiveDebt + totalBusinessDebt;

  // --- C. KEKAYAAN BERSIH (H) ---
  const netWorth = totalAssets - totalDebt;

  // --- D. ARUS KAS TAHUNAN (FLOW - Wajib Dikali 12) ---
  
  // Total Penghasilan Tahunan (I) -> FIX: Dikali 12
  const totalAnnualIncome = (val(data.incomeFixed) + val(data.incomeVariable)) * 12;

  // E. Pengeluaran Tahunan
  // Cicilan Utang Konsumtif (J)
  const totalConsumptiveInstallment =
    (val(data.installmentKPR) +
      val(data.installmentKPM) +
      val(data.installmentCC) +
      val(data.installmentCoop) +
      val(data.installmentConsumptiveOther)) *
    12;

  // Total Cicilan Utang (K)
  const totalAnnualInstallment =
    totalConsumptiveInstallment + (val(data.installmentBusiness) * 12);

  // Total Premi Asuransi (L)
  const totalInsurance =
    (val(data.insuranceLife) +
      val(data.insuranceHealth) +
      val(data.insuranceHome) +
      val(data.insuranceVehicle) +
      val(data.insuranceBPJS) +
      val(data.insuranceOther)) * 12;

  // Total Tabungan/Investasi (M)
  const totalAnnualSaving =
    (val(data.savingEducation) +
      val(data.savingRetirement) +
      val(data.savingPilgrimage) +
      val(data.savingHoliday) +
      val(data.savingEmergency) +
      val(data.savingOther)) *
    12;

  // Total Belanja Keluarga (N)
  // FIX: expenseTax juga dikali 12 karena FE mengirim "Monthly Equivalent Tax"
  const totalFamilyExpense =
    (val(data.expenseFood) +
      val(data.expenseSchool) +
      val(data.expenseTransport) +
      val(data.expenseCommunication) +
      val(data.expenseHelpers) +
      val(data.expenseLifestyle) +
      val(data.expenseTax)) *
    12;

  // Total Pengeluaran (O)
  const totalAnnualExpense =
    totalAnnualInstallment +
    totalInsurance +
    totalAnnualSaving +
    totalFamilyExpense;

  // Pengeluaran Bulanan (P) - Rata-rata
  const monthlyExpense = totalAnnualExpense / 12;

  // Surplus/Defisit (Q)
  const surplusDeficit = (totalAnnualIncome - totalAnnualExpense) / 12; // Return dalam satuan Bulanan

  // --- 2. PERHITUNGAN 8 RASIO (LOGIKA TETAP SAMA) ---
  const ratios: RatioDetail[] = [];
  
  // #1. RASIO DANA DARURAT (A / P)
  const r1 = monthlyExpense > 0 ? totalLiquid / monthlyExpense : 0;
  let s1: any = 'RED';
  let rec1 = 'Dana darurat sangat kurang (< 3 bulan). Risiko tinggi!';

  if (r1 >= 3 && r1 <= 6) {
    s1 = 'GREEN_DARK';
    rec1 = 'Ideal (3-6 bulan).';
  } else if (r1 > 6 && r1 <= 12) {
    s1 = 'GREEN_LIGHT';
    rec1 = 'Aman, tapi agak berlebih (7-12 bulan).';
  } else if (r1 > 12) {
    s1 = 'YELLOW';
    rec1 = 'Terlalu banyak uang menganggur (> 12 bulan). Investasikan ke instrumen produktif.';
  } else {
    s1 = 'RED'; // < 3
  }

  ratios.push({
    id: 'emergency_fund',
    label: 'Rasio Dana Darurat',
    value: parseFloat(r1.toFixed(1)),
    benchmark: '3 - 6 kali',
    statusColor: s1,
    recommendation: rec1,
  });

  // #2. RASIO LIKUIDITAS vs KEKAYAAN BERSIH (A / H)
  const r2 = netWorth > 0 ? (totalLiquid / netWorth) * 100 : 0;
  let s2: any = 'RED';
  let rec2 = 'Aset likuid terlalu sedikit (< 15%). Susah cairkan uang.';

  if (r2 > 50) {
    s2 = 'GREEN_DARK'; // Logic disesuaikan agar >50% hijau tua (sangat likuid)
    rec2 = 'Sangat likuid (> 50%).';
  } else if (r2 >= 15) { // Benchmark Min 15%
    s2 = 'GREEN_LIGHT';
    rec2 = 'Cukup likuid (15-50%).';
  } else if (r2 >= 10) {
    s2 = 'YELLOW';
    rec2 = 'Agak ketat (10-15%).';
  } else {
    s2 = 'RED'; // < 10
  }

  ratios.push({
    id: 'liq_networth',
    label: 'Likuiditas vs Net Worth',
    value: parseFloat(r2.toFixed(1)),
    benchmark: 'Min 15%',
    statusColor: s2,
    recommendation: rec2,
  });

  // #3. RASIO TABUNGAN (M / I)
  const r3 =
    totalAnnualIncome > 0
      ? (totalAnnualSaving / totalAnnualIncome) * 100
      : 0;
  let s3: any = 'RED';
  let rec3 = 'Kurang menabung (< 10%). Masa depan terancam.';

  if (r3 >= 20) {
    s3 = 'GREEN_DARK';
    rec3 = 'Excellent! Menabung > 20%.';
  } else if (r3 >= 10) {
    s3 = 'GREEN_LIGHT';
    rec3 = 'Sudah ideal (10-20%).';
  } else {
    s3 = 'RED'; // < 10
  }

  ratios.push({
    id: 'saving_ratio',
    label: 'Rasio Tabungan',
    value: parseFloat(r3.toFixed(1)),
    benchmark: 'Min 10%',
    statusColor: s3,
    recommendation: rec3,
  });

  // #4. RASIO UTANG vs ASET (G / D)
  const r4 = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
  let s4: any = 'RED';
  let rec4 = 'Bahaya! Utang > 50% Aset. Risiko kebangkrutan.';

  if (r4 < 30) {
    s4 = 'GREEN_DARK';
    rec4 = 'Sangat sehat. Utang sangat kecil (< 30%).';
  } else if (r4 <= 50) {
    s4 = 'GREEN_LIGHT';
    rec4 = 'Masih wajar (30-50%).';
  } else {
    s4 = 'RED'; // > 50
  }

  ratios.push({
    id: 'debt_asset_ratio',
    label: 'Rasio Utang vs Aset',
    value: parseFloat(r4.toFixed(1)),
    benchmark: 'Maks 50%',
    statusColor: s4,
    recommendation: rec4,
  });

  // #5. RASIO CICILAN UTANG (K / I)
  const r5 =
    totalAnnualIncome > 0
      ? (totalAnnualInstallment / totalAnnualIncome) * 100
      : 0;
  let s5: any = 'RED';
  let rec5 = 'Overleverage! Cicilan > 35% penghasilan.';

  if (r5 < 30) {
    s5 = 'GREEN_DARK';
    rec5 = 'Beban cicilan aman (< 30%).';
  } else if (r5 <= 35) {
    s5 = 'YELLOW';
    rec5 = 'Waspada (30-35%). Jangan tambah utang.';
  } else {
    s5 = 'RED'; // > 35
  }

  ratios.push({
    id: 'debt_service_ratio',
    label: 'Rasio Cicilan Total',
    value: parseFloat(r5.toFixed(1)),
    benchmark: 'Maks 35%',
    statusColor: s5,
    recommendation: rec5,
  });

  // #6. RASIO CICILAN KONSUMTIF (J / I)
  const r6 =
    totalAnnualIncome > 0
      ? (totalConsumptiveInstallment / totalAnnualIncome) * 100
      : 0;
  let s6: any = 'RED';
  let rec6 = 'Boros! Cicilan konsumtif > 15%. Stop hutang baru.';

  if (r6 <= 15) {
    s6 = 'GREEN_DARK';
    rec6 = 'Terkendali (<= 15%).';
  } else {
    s6 = 'RED'; // > 15
  }

  ratios.push({
    id: 'consumptive_ratio',
    label: 'Rasio Utang Konsumtif',
    value: parseFloat(r6.toFixed(1)),
    benchmark: 'Maks 15%',
    statusColor: s6,
    recommendation: rec6,
  });

  // #7. RASIO ASET INVESTASI vs KEKAYAAN BERSIH (C / H)
  const r7 = netWorth > 0 ? (totalInvestment / netWorth) * 100 : 0;
  let s7: any = 'RED';
  let rec7 = 'Aset mayoritas konsumtif. Tingkatkan investasi.';

  if (r7 >= 50) {
    s7 = 'GREEN_DARK';
    rec7 = 'Portofolio produktif (> 50%).';
  } else if (r7 >= 25) {
    s7 = 'YELLOW'; // Warning jika di bawah 50 tapi diatas 25
    rec7 = 'Mulai bertumbuh (25-50%).';
  } else {
    s7 = 'RED'; // < 25
  }

  ratios.push({
    id: 'invest_asset_ratio',
    label: 'Rasio Aset Investasi',
    value: parseFloat(r7.toFixed(1)),
    benchmark: 'Min 50%',
    statusColor: s7,
    recommendation: rec7,
  });

  // #8. RASIO SOLVABILITAS (H / D)
  const r8 = totalAssets > 0 ? (netWorth / totalAssets) * 100 : 0;
  let s8: any = 'RED';
  let rec8 = 'Risiko kebangkrutan tinggi! Modal sendiri < 30%.';

  if (r8 >= 50) {
    s8 = 'GREEN_DARK';
    rec8 = 'Sehat (> 50%).';
  } else if (r8 >= 30) {
    s8 = 'YELLOW';
    rec8 = 'Cukup sehat (30-50%).';
  } else {
    s8 = 'RED'; // < 30
  }

  ratios.push({
    id: 'solvency_ratio',
    label: 'Rasio Solvabilitas',
    value: parseFloat(r8.toFixed(1)),
    benchmark: 'Min 50%',
    statusColor: s8,
    recommendation: rec8,
  });

  // --- 3. LOGIKA PENENTUAN STATUS AKHIR ---
  const allColors = ratios.map(r => r.statusColor);

  let globalStatus: 'SEHAT' | 'WASPADA' | 'BAHAYA' = 'SEHAT';
  let score = 100;

  if (allColors.includes('RED')) {
    globalStatus = 'BAHAYA';
    score = 25; 
  } else if (allColors.includes('YELLOW')) {
    globalStatus = 'WASPADA';
    score = 60; 
  } else {
    globalStatus = 'SEHAT';
    const allPerfect = allColors.every(c => c === 'GREEN_DARK');
    score = allPerfect ? 100 : 90; 
  }

  return {
    score,
    globalStatus,
    ratios,
    netWorth,
    surplusDeficit,
    generatedAt: new Date().toISOString(),
    // Feedback data raw untuk Frontend (opsional)
    incomeFixed: val(data.incomeFixed),
    incomeVariable: val(data.incomeVariable)
  };
};

// ============================================================================
// 2. TVM (TIME VALUE OF MONEY) CORE HELPERS
// ============================================================================

/**
 * Menghitung Future Value (Nilai Masa Depan)
 * @param rate Rate per periode (bukan persen, misal 10% = 0.1)
 * @param nper Jumlah periode
 * @param pmt Pembayaran per periode (negatif jika keluar uang)
 * @param pv Nilai sekarang (negatif jika keluar uang)
 * @param type 0 = akhir periode, 1 = awal periode
 */
export const calculateFV = (rate: number, nper: number, pmt: number, pv: number, type: 0 | 1 = 0) => {
    if (rate === 0) return -(pv + pmt * nper);
    const pow = Math.pow(1 + rate, nper);
    return -((pv * pow) + (pmt * (1 + rate * type) * (pow - 1) / rate));
};

/**
 * Menghitung PMT (Anuitas / Tabungan Rutin)
 * @param rate Rate per periode (bukan persen, misal 0.08/12)
 * @param nper Jumlah periode (bulan)
 * @param pv Nilai sekarang (modal awal)
 * @param fv Nilai masa depan yang diinginkan
 * @param type 0 = akhir periode, 1 = awal periode
 */
export const calculatePMT = (rate: number, nper: number, pv: number, fv: number = 0, type: 0 | 1 = 0) => {
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    return -(rate * (fv + (pv * pvif))) / ((pvif - 1) * (1 + rate * type));
};

// ============================================================================
// 3. CALCULATOR MODULES (Logic for Pension, Education, Insurance, Goals)
// ============================================================================

/**
 * LOGIKA: DANA PENSIUN (UPDATED VERSION)
 * Menggunakan Algoritma PV Annuity Due dengan Nett Rate (Sesuai Excel Referensi)
 * - Menghitung kebutuhan dana berdasarkan selisih bunga investasi dan inflasi.
 * - Tabungan bulanan dihitung dari Annual Sinking Fund dibagi 12.
 */
export const calculatePensionPlan = (data: CreatePensionDto) => {
    const { 
        currentAge, 
        retirementAge, 
        lifeExpectancy = 80, 
        currentExpense, 
        currentSaving = 0, 
        inflationRate = 5, 
        returnRate = 8 
    } = data;
    
    // --- 1. SETUP VARIABEL WAKTU ---
    const yearsToRetire = retirementAge - currentAge;
    const retirementDuration = lifeExpectancy - retirementAge;

    if (yearsToRetire <= 0) {
        throw new Error("Usia pensiun harus lebih besar dari usia sekarang");
    }
    if (retirementDuration <= 0) {
        throw new Error("Usia harapan hidup harus lebih besar dari usia pensiun");
    }

    // --- 2. KONVERSI RATE KE DESIMAL ---
    const iRate = inflationRate / 100; // Inflasi (ex: 0.04)
    const rRate = returnRate / 100;    // Return Investasi (ex: 0.08)
    
    // Hitung Nett Rate (Selisih bunga) untuk masa pensiun
    // Sesuai Excel: r_nett = r_invest - r_inflasi
    const nettRate = rRate - iRate;

    // --- 3. HITUNG BIAYA HIDUP NANTI (FV Expense) ---
    // Excel menggunakan basis Tahunan. 
    // Rumus: BiayaSekarang * (1 + inflasi)^TahunMenujuPensiun
    const annualExpenseCurrent = currentExpense * 12;
    const futureAnnualExpense = annualExpenseCurrent * Math.pow(1 + iRate, yearsToRetire);

    // --- 4. HITUNG TOTAL DANA YANG DIBUTUHKAN (NEST EGG / TOTAL FUND) ---
    // Menggunakan Rumus "Present Value of Annuity Due" (PVAD)
    // Dana ini dibutuhkan di awal masa pensiun untuk membiayai hidup selama X tahun (retirementDuration)
    // dengan asumsi uang sisa tetap tumbuh sebesar nettRate.
    // Rumus: PMT * [ (1 - (1+r)^-n) / r ] * (1+r)
    // Note: Jika nettRate 0, gunakan rumus simplifikasi (PMT * n)
    
    let totalFundNeeded = 0;
    if (nettRate === 0) {
        totalFundNeeded = futureAnnualExpense * retirementDuration;
    } else {
        const pvadFactor = (1 - Math.pow(1 + nettRate, -retirementDuration)) / nettRate;
        totalFundNeeded = futureAnnualExpense * pvadFactor * (1 + nettRate);
    }

    // --- 5. HITUNG NILAI MASA DEPAN ASET SAAT INI (FV Existing Fund) ---
    // Rumus: ModalAwal * (1 + Return)^Tahun
    const fvExistingFund = currentSaving * Math.pow(1 + rRate, yearsToRetire);

    // --- 6. HITUNG KEKURANGAN DANA (SHORTFALL) ---
    // Ini target dana bersih yang harus dikumpulkan lewat tabungan baru
    // Pastikan tidak negatif (kalau aset sudah cukup, shortfall 0)
    const shortfall = Math.max(0, totalFundNeeded - fvExistingFund);

    // --- 7. HITUNG TABUNGAN RUTIN (PMT) ---
    // Menggunakan rumus Sinking Fund Tahunan lalu dibagi 12
    // Rumus PMT: FV * r / ((1+r)^n - 1)
    
    let annualSaving = 0;
    if (shortfall > 0) {
        if (rRate === 0) {
            annualSaving = shortfall / yearsToRetire;
        } else {
            const sinkingFundFactor = Math.pow(1 + rRate, yearsToRetire) - 1;
            annualSaving = (shortfall * rRate) / sinkingFundFactor;
        }
    }

    const monthlySaving = annualSaving / 12;

    // --- RETURN HASIL ---
    return {
        yearsToRetire,
        retirementDuration,
        // Return monthly untuk konsistensi UI, tapi dihitung dari annual logic
        futureMonthlyExpense: futureAnnualExpense / 12, 
        totalFundNeeded, // Ini Gross Need (PVAD) sesuai Excel cell 1.2
        fvExistingFund,  // Nilai aset nanti (Excel 1.3)
        shortfall,       // Kekurangan (Excel "Dana Hari Tua" di sheet Calc)
        monthlySaving    // Hasil akhir (Excel "Tabungan bulanan")
    };
};

/**
 * LOGIKA: ASURANSI JIWA (UP IDEAL) - UPDATED
 * Menggunakan "Income Replacement Method" dengan pendekatan PVAD (Present Value Annuity Due).
 * Rumus sesuai dokumen: PVAD = PMT * [ (1 - (1+r)^-n) / r ] * (1+r)
 * Dimana r = Nett Rate (Investasi - Inflasi).
 */
export const calculateInsurancePlan = (data: CreateInsuranceDto) => { // Pastikan nama fungsi konsisten
    const { 
        monthlyExpense, 
        existingDebt = 0, 
        existingCoverage = 0, 
        protectionDuration = 10,
        // Default value jika user tidak isi (bisa disesuaikan dengan global setting)
        inflationRate = 5, 
        returnRate = 7,
        // Opsional: Biaya Duka (sesuai dokumen Poin 4.C), default 0 atau bisa diset misal 50jt
        // Pastikan DTO juga update jika ingin field ini dinamis dari FE
        funeralCost = 0 
    } = data as any; // Cast as any sementara jika DTO belum update

    // 1. Hitung Bunga Riil / Nett Rate (r)
    // Dokumen Poin 4.B.5: Nett interest = Target investasi - Inflasi
    const iRate = inflationRate / 100;
    const rRate = returnRate / 100;
    const nettRate = rRate - iRate;

    // 2. Hitung Income Replacement (PVAD)
    // Dokumen Poin 4.B.1: PMT harus Tahunan
    const annualExpense = monthlyExpense * 12; 
    const n = protectionDuration;

    let incomeReplacementValue = 0;

    if (nettRate === 0) {
        // KASUS KHUSUS: Jika Investasi == Inflasi, atau keduanya 0
        // Maka hitungannya linear (Bunga impas dengan kenaikan harga)
        incomeReplacementValue = annualExpense * n;
    } else {
        // RUMUS UTAMA (PVAD)
        // PVAD = PMT * [ (1 - (1+r)^-n) / r ] * (1+r)
        // Faktor Diskonto Anuitas
        const discountFactor = (1 - Math.pow(1 + nettRate, -n)) / nettRate;
        
        // Dikali (1+r) karena asumsi penarikan di AWAL tahun (Due)
        incomeReplacementValue = annualExpense * discountFactor * (1 + nettRate);
    }

    // 3. Debt Clearance (Pelunasan Hutang)
    const debtClearanceValue = existingDebt;

    // 4. Biaya Duka & Lainnya
    // (Jika ada input dari FE, akan dihitung disini)
    const otherNeeds = funeralCost; 

    // 5. Total Kebutuhan UP (Gross)
    const totalNeeded = incomeReplacementValue + debtClearanceValue + otherNeeds;

    // 6. Hitung Gap (Kekurangan)
    // Dikurangi asuransi yang sudah ada (Poin 4.D)
    const coverageGap = Math.max(0, totalNeeded - existingCoverage);

    // 7. Rekomendasi
    let recommendation = "";
    if (coverageGap <= 0) {
        recommendation = "Selamat! Nilai perlindungan asuransi Anda saat ini sudah mencukupi kebutuhan keluarga (Income Replacement & Pelunasan Hutang).";
    } else {
        const formattedGap = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(coverageGap);
        recommendation = `Keluarga Anda membutuhkan dana tambahan sebesar ${formattedGap} untuk bertahan hidup selama ${n} tahun dan melunasi hutang jika terjadi risiko. Disarankan menambah UP Asuransi Jiwa Berjangka (Term Life).`;
    }

    return {
        // Detail Rincian untuk ditampilkan di FE
        annualExpense,      // PMT
        nettRatePercentage: (nettRate * 100).toFixed(2), // r dalam %
        incomeReplacementValue, // Hasil PVAD (Dana Warisan Hidup)
        debtClearanceValue,
        otherNeeds,
        
        // Hasil Akhir
        totalNeeded,
        coverageGap,
        recommendation
    };
};

/**
 * LOGIKA: GOALS (TUJUAN KEUANGAN)
 * Menghitung kebutuhan menabung bulanan untuk mencapai target dana di masa depan.
 */
export const calculateGoalPlan = (data: CreateGoalDto) => {
    const { targetAmount, targetDate, inflationRate = 5, returnRate = 6 } = data;

    const now = new Date();
    const target = new Date(targetDate);
    
    // 1. Hitung durasi bulan (nper)
    const monthsDuration = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());

    if (monthsDuration <= 0) {
        throw new Error("Target waktu harus di masa depan");
    }

    const yearsDuration = monthsDuration / 12;

    // 2. Hitung Nilai Masa Depan Target (FV akibat Inflasi)
    // Jika beli rumah 5 tahun lagi, harganya pasti naik kena inflasi
    const futureTargetAmount = targetAmount * Math.pow(1 + (inflationRate / 100), yearsDuration);

    // 3. Hitung Tabungan Bulanan (PMT)
    const monthlyRate = (returnRate / 100) / 12;
    
    // REVISI DISINI: Tambahkan Math.abs() agar output positif
    const monthlySaving = Math.abs(calculatePMT(
        monthlyRate, 
        monthsDuration, 
        0, // Mulai dari 0
        futureTargetAmount
    ));

    return {
        monthsDuration,
        futureTargetAmount, // Nilai target setelah inflasi
        monthlySaving
    };
};

/**
 * ------------------------------------------------------------------
 * UPDATE UTAMA: DANA PENDIDIKAN (GRANULAR SINKING FUND)
 * ------------------------------------------------------------------
 * Menggunakan metode "Cashflow Matching" sesuai Dokumen Referensi.
 * Setiap jenjang dihitung mandiri (Sinking Fund terpisah), lalu dijumlahkan.
 */
export const calculateEducationPlan = (data: CreateEducationPlanDto) => {
    const { inflationRate = 10, returnRate = 12, stages } = data;
    
    let totalFutureCost = 0;
    let totalMonthlySaving = 0; 

    const stagesBreakdown: Array<typeof stages[0] & { futureCost: number; monthlySaving: number }> = [];

    // --- LOOPING SETIAP ITEM BIAYA (GRANULAR) ---
    for (const stage of stages) {
        // [GUARD CLAUSE] Validasi jika cost 0 (misal S2 tanpa SPP bulanan), langsung return 0
        if (stage.currentCost <= 0) {
            stagesBreakdown.push({
                ...stage,
                futureCost: 0,
                monthlySaving: 0
            });
            continue; // Skip perhitungan TVM
        }

        // 1. Tentukan Jarak Waktu (Years To Start)
        const years = Math.max(0, stage.yearsToStart); 
        const months = years * 12;

        // 2. Hitung Future Value (FV) akibat Inflasi
        const iRate = inflationRate / 100;
        const futureCost = stage.currentCost * Math.pow(1 + iRate, years);

        // 3. Hitung Tabungan Bulanan (PMT) Khusus Item Ini
        let monthlySavingItem = 0;

        if (months > 0) {
            const rRateMonthly = (returnRate / 100) / 12; 
            
            // Rumus PMT untuk target FV
            monthlySavingItem = Math.abs(calculatePMT(rRateMonthly, months, 0, futureCost));
        } else {
            // Jika waktunya 0 (harus bayar sekarang), tidak bisa ditabung
            monthlySavingItem = 0; 
        }

        // 4. Akumulasi ke Total Global
        totalFutureCost += futureCost;
        totalMonthlySaving += monthlySavingItem;

        // 5. Simpan Rincian
        stagesBreakdown.push({
            ...stage,
            futureCost: futureCost,
            monthlySaving: monthlySavingItem
        });
    }

    return {
        totalFutureCost,
        monthlySaving: totalMonthlySaving, 
        stagesBreakdown 
    };
};

// ============================================================================
// 4. BUDGETING ENGINE
// ============================================================================

/**
 * LOGIKA: BUDGET SPLIT (SMART BUDGETING 45/20/15/10/10)
 * Menghitung alokasi otomatis berdasarkan total pendapatan jika user tidak 
 * memasukkan rincian pengeluaran secara manual.
 * * Rasio yang digunakan:
 * - Living Cost (Kebutuhan): 45%
 * - Productive Debt (Cicilan Produktif): 20%
 * - Consumptive Debt (Cicilan Konsumtif): 15%
 * - Insurance (Premi Asuransi): 10%
 * - Saving (Tabungan/Investasi): 10%
 */
export const calculateBudgetSplit = (totalIncome: number) => {
  return {
    livingCost: totalIncome * 0.45,
    productiveDebt: totalIncome * 0.20,
    consumptiveDebt: totalIncome * 0.15,
    insurance: totalIncome * 0.10,
    saving: totalIncome * 0.10,
  };
};