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
}

// ============================================================================
// 1. FINANCIAL HEALTH CHECK UP ENGINE (EXISTING)
// ============================================================================

export const calculateFinancialHealth = (
  data: CreateFinancialRecordDto,
): HealthAnalysisResult => {
  // --- 1. AGGREGATION (PENGGABUNGAN DATA) ---

  // Helper untuk memastikan angka valid (prevent NaN)
  const val = (n: number) => Number(n) || 0;

  // A. Total Aset
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

  // B. Total Utang (Saldo Pokok)
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

  // C. Kekayaan Bersih (H)
  const netWorth = totalAssets - totalDebt;

  // D. Arus Kas (Tahunan)
  // Total Penghasilan (I)
  const totalAnnualIncome = val(data.incomeFixed) + val(data.incomeVariable);

  // E. Pengeluaran Tahunan
  // Cicilan Utang Konsumtif (J) - Input Bulanan dikali 12
  const totalConsumptiveInstallment =
    (val(data.installmentKPR) +
      val(data.installmentKPM) +
      val(data.installmentCC) +
      val(data.installmentCoop) +
      val(data.installmentConsumptiveOther)) *
    12;

  // Total Cicilan Utang (K) = J + (Cicilan Usaha * 12)
  const totalAnnualInstallment =
    totalConsumptiveInstallment + val(data.installmentBusiness) * 12;

  // Total Premi Asuransi (L) - Input Tahunan
  const totalInsurance =
    val(data.insuranceLife) +
    val(data.insuranceHealth) +
    val(data.insuranceHome) +
    val(data.insuranceVehicle) +
    val(data.insuranceBPJS) +
    val(data.insuranceOther);

  // Total Tabungan/Investasi (M) - Input Bulanan dikali 12
  const totalAnnualSaving =
    (val(data.savingEducation) +
      val(data.savingRetirement) +
      val(data.savingPilgrimage) +
      val(data.savingHoliday) +
      val(data.savingEmergency) +
      val(data.savingOther)) *
    12;

  // Total Belanja Keluarga (N) - Input Bulanan dikali 12 (Kecuali Pajak Tahunan)
  const totalFamilyExpense =
    (val(data.expenseFood) +
      val(data.expenseSchool) +
      val(data.expenseTransport) +
      val(data.expenseCommunication) +
      val(data.expenseHelpers) +
      val(data.expenseLifestyle)) *
      12 +
    val(data.expenseTax); // Pajak PBB/PKB biasanya tahunan

  // Total Pengeluaran (O)
  const totalAnnualExpense =
    totalAnnualInstallment +
    totalInsurance +
    totalAnnualSaving +
    totalFamilyExpense;

  // Pengeluaran Bulanan (P) - Rata-rata
  const monthlyExpense = totalAnnualExpense / 12;

  // Surplus/Defisit (Q)
  const surplusDeficit = totalAnnualIncome - totalAnnualExpense;

  // --- 2. PERHITUNGAN 8 RASIO ---
  const ratios: RatioDetail[] = [];
  let passedRatios = 0;

  // #1. RASIO DANA DARURAT (A / P)
  const r1 = monthlyExpense > 0 ? totalLiquid / monthlyExpense : 0;
  let s1: any = 'RED';
  let rec1 = 'Dana darurat sangat kurang (< 3 bulan). Risiko tinggi!';

  if (r1 >= 3 && r1 <= 6) {
    s1 = 'GREEN_DARK';
    rec1 = 'Ideal (3-6 bulan).';
    passedRatios++;
  } else if (r1 >= 7 && r1 <= 12) {
    s1 = 'GREEN_LIGHT';
    rec1 = 'Aman, tapi agak berlebih (7-12 bulan).';
    passedRatios++;
  } else if (r1 > 12) {
    s1 = 'YELLOW';
    rec1 =
      'Terlalu banyak uang menganggur (> 12 bulan). Investasikan ke instrumen produktif.';
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
    s2 = 'GREEN_DARK';
    rec2 = 'Sangat likuid (> 50%).';
    passedRatios++;
  } else if (r2 >= 20) {
    s2 = 'GREEN_LIGHT';
    rec2 = 'Cukup likuid (20-50%).';
    passedRatios++;
  } else if (r2 >= 15) {
    s2 = 'YELLOW';
    rec2 = 'Agak ketat (15-20%).';
  } else {
    s2 = 'RED'; // < 15
  }

  ratios.push({
    id: 'liq_networth',
    label: 'Likuiditas vs Net Worth',
    value: parseFloat(r2.toFixed(1)),
    benchmark: '15% - 20%',
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

  if (r3 >= 30) {
    s3 = 'GREEN_DARK';
    rec3 = 'Excellent! Menabung > 30%.';
    passedRatios++;
  } else if (r3 >= 20) {
    s3 = 'GREEN_LIGHT';
    rec3 = 'Sangat baik (20-30%).';
    passedRatios++;
  } else if (r3 >= 10) {
    s3 = 'YELLOW';
    rec3 = 'Cukup (10-20%). Tingkatkan lagi.';
    passedRatios++;
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

  if (r4 < 15) {
    s4 = 'GREEN_DARK';
    rec4 = 'Sangat sehat. Utang sangat kecil (< 15%).';
    passedRatios++;
  } else if (r4 < 35) {
    s4 = 'GREEN_LIGHT';
    rec4 = 'Wajar (15-35%).';
    passedRatios++;
  } else if (r4 <= 50) {
    s4 = 'YELLOW';
    rec4 = 'Hati-hati. Utang mendekati batas aman (35-50%).';
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

  if (r5 < 10) {
    s5 = 'GREEN_DARK';
    rec5 = 'Beban cicilan sangat ringan (< 10%).';
    passedRatios++;
  } else if (r5 < 15) {
    s5 = 'GREEN_LIGHT';
    rec5 = 'Ringan (10-15%).';
    passedRatios++;
  } else if (r5 <= 35) {
    s5 = 'YELLOW';
    rec5 = 'Waspada (15-35%). Jangan tambah utang.';
  } else {
    s5 = 'RED'; // > 35
  }

  ratios.push({
    id: 'debt_service_ratio',
    label: 'Rasio Cicilan Utang',
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

  if (r6 < 5) {
    s6 = 'GREEN_DARK';
    rec6 = 'Sangat hemat. Cicilan konsumtif < 5%.';
    passedRatios++;
  } else if (r6 < 10) {
    s6 = 'GREEN_LIGHT';
    rec6 = 'Terkendali (5-10%).';
    passedRatios++;
  } else if (r6 <= 15) {
    s6 = 'YELLOW';
    rec6 = 'Batas wajar (10-15%).';
  } else {
    s6 = 'RED'; // > 15
  }

  ratios.push({
    id: 'consumptive_ratio',
    label: 'Rasio Cicilan Konsumtif',
    value: parseFloat(r6.toFixed(1)),
    benchmark: 'Maks 15%',
    statusColor: s6,
    recommendation: rec6,
  });

  // #7. RASIO ASET INVESTASI vs KEKAYAAN BERSIH (C / H)
  const r7 = netWorth > 0 ? (totalInvestment / netWorth) * 100 : 0;
  let s7: any = 'RED';
  let rec7 = 'Aset mayoritas konsumtif/mati. Tingkatkan investasi.';

  if (r7 > 50) {
    s7 = 'GREEN_DARK';
    rec7 = 'Portofolio produktif (> 50%).';
    passedRatios++;
  } else if (r7 >= 25) {
    s7 = 'GREEN_LIGHT';
    rec7 = 'Cukup (25-50%).';
    passedRatios++;
  } else if (r7 >= 10) {
    s7 = 'YELLOW';
    rec7 = 'Kurang (10-25%).';
  } else {
    s7 = 'RED'; // < 10
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
  let rec8 = 'Risiko kebangkrutan tinggi! Modal sendiri < 25%.';

  if (r8 > 75) {
    s8 = 'GREEN_DARK';
    rec8 = 'Sangat kuat (> 75% modal sendiri).';
    passedRatios++;
  } else if (r8 >= 50) {
    s8 = 'GREEN_LIGHT';
    rec8 = 'Sehat (50-75%).';
    passedRatios++;
  } else if (r8 >= 25) {
    s8 = 'YELLOW';
    rec8 = 'Rentan (25-50%).';
  } else {
    s8 = 'RED'; // < 25
  }

  ratios.push({
    id: 'solvency_ratio',
    label: 'Rasio Solvabilitas',
    value: parseFloat(r8.toFixed(1)),
    benchmark: 'Min 50%',
    statusColor: s8,
    recommendation: rec8,
  });

  // --- FINAL SCORE ---
  const score = Math.round((passedRatios / 8) * 100);

  let globalStatus: 'SEHAT' | 'WASPADA' | 'BAHAYA' = 'BAHAYA';
  if (score >= 80) globalStatus = 'SEHAT';
  else if (score >= 50) globalStatus = 'WASPADA';

  return {
    score,
    globalStatus,
    ratios,
    netWorth,
    surplusDeficit,
    generatedAt: new Date().toISOString(),
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
 * LOGIKA: DANA PENSIUN
 * Menggunakan metode "Expense Replacement" yang disesuaikan dengan 4% Rule (Rule of 25)
 * untuk menentukan target dana (Nest Egg).
 */
export const calculatePensionPlan = (data: CreatePensionDto) => {
    const { currentAge, retirementAge, currentExpense, currentSaving = 0, inflationRate = 5, returnRate = 8 } = data;
    
    // 1. Hitung durasi menabung
    const yearsToRetire = retirementAge - currentAge;
    const monthsToRetire = yearsToRetire * 12;

    if (yearsToRetire <= 0) {
        throw new Error("Usia pensiun harus lebih besar dari usia sekarang");
    }

    // 2. Hitung Biaya Hidup di Masa Depan (Future Value of Expense)
    // Rumus: Expense * (1 + inflation)^years
    const futureMonthlyExpense = currentExpense * Math.pow(1 + (inflationRate / 100), yearsToRetire);

    // 3. Hitung Total Dana Pensiun yang Dibutuhkan (Nest Egg)
    // Menggunakan Rule of 300 (25 tahun x 12 bulan) alias 4% Rule yang lebih konservatif
    // Artinya: Dana harus cukup untuk ditarik 4% per tahun selamanya (atau 25 tahun masa pensiun)
    const totalFundNeeded = futureMonthlyExpense * 300; 

    // 4. Hitung Tabungan Bulanan yang Diperlukan (PMT)
    // Rate investasi bulanan
    const monthlyRate = (returnRate / 100) / 12;
    
    // PMT Calculation
    // PV = Current Saving (Negatif karena uang sudah ada/ditanam)
    // FV = Total Fund Needed (Positif karena ini target kita)
    const monthlySaving = calculatePMT(
        monthlyRate, 
        monthsToRetire, 
        -currentSaving, 
        totalFundNeeded
    );

    return {
        yearsToRetire,
        futureMonthlyExpense,
        totalFundNeeded, // FV Target
        monthlySaving // PMT result
    };
};

/**
 * LOGIKA: ASURANSI JIWA (UP IDEAL)
 * Menggunakan "Income Replacement Method" + Pelunasan Hutang
 */
export const calculateInsuranceNeeds = (data: CreateInsuranceDto) => {
    const { monthlyExpense, dependentCount, existingDebt = 0, existingCoverage = 0, protectionDuration = 10 } = data;

    // 1. Income Replacement (Penggantian Nafkah)
    // Berapa uang yang dibutuhkan keluarga untuk bertahan hidup selama X tahun
    // jika pencari nafkah meninggal dunia.
    // Rumus: Pengeluaran Bulanan x 12 x Durasi Proteksi
    const incomeReplacementValue = monthlyExpense * 12 * protectionDuration;

    // 2. Debt Clearance (Pelunasan Hutang)
    // Hutang harus lunas agar tidak membebani ahli waris
    const debtClearanceValue = existingDebt;

    // 3. Total Kebutuhan UP (Uang Pertanggungan)
    const totalNeeded = incomeReplacementValue + debtClearanceValue;

    // 4. Gap (Kekurangan)
    // Jika sudah punya asuransi dari kantor/pribadi, kurangi dari total kebutuhan
    const coverageGap = Math.max(0, totalNeeded - existingCoverage);

    let recommendation = "";
    if (coverageGap <= 0) {
        recommendation = "Selamat! Anda sudah memiliki perlindungan asuransi yang cukup (Overinsured).";
    } else {
        recommendation = `Anda membutuhkan tambahan Uang Pertanggungan sebesar Rp ${coverageGap.toLocaleString('id-ID')}. Disarankan mengambil Asuransi Jiwa Berjangka (Term Life) karena preminya lebih terjangkau.`;
    }

    return {
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
    
    const monthlySaving = calculatePMT(
        monthlyRate, 
        monthsDuration, 
        0, // Mulai dari 0
        futureTargetAmount
    );

    return {
        monthsDuration,
        futureTargetAmount, // Nilai target setelah inflasi
        monthlySaving
    };
};

/**
 * LOGIKA: DANA PENDIDIKAN
 * Kompleksitas tinggi: Menghitung FV setiap jenjang sekolah lalu di-sum.
 */
export const calculateEducationPlan = (data: CreateEducationPlanDto) => {
    const { childDob, inflationRate = 10, returnRate = 12, stages } = data;
    const dob = new Date(childDob);
    const now = new Date();
    
    // Hitung Usia Anak (dalam tahun float)
    const ageInMilliseconds = now.getTime() - dob.getTime();
    const currentAge = ageInMilliseconds / (1000 * 60 * 60 * 24 * 365.25);

    let totalFutureCost = 0;
    const stagesDetail: Array<typeof stages[0] & { calculatedFutureCost: number }> = [];

    // Loop setiap jenjang sekolah (TK, SD, SMP, SMA, PT)
    for (const stage of stages) {
        // 1. Hitung kapan masuk sekolah (Time to Start)
        // yearsToStart biasanya dikirim dari FE (misal masuk TK umur 4, sekarang umur 1, berarti n=3)
        // Jika yearsToStart negatif, anggap 0 (sudah lewat/sedang berjalan)
        const yearsToStart = Math.max(0, stage.yearsToStart);
        
        // 2. Hitung FV Biaya Sekolah (Inflasi)
        // Biaya Nanti = Biaya Sekarang * (1 + inflasi)^tahun
        const futureCost = stage.currentCost * Math.pow(1 + (inflationRate / 100), yearsToStart);
        
        totalFutureCost += futureCost;

        stagesDetail.push({
            ...stage,
            calculatedFutureCost: futureCost
        });
    }

    // 3. Hitung Tabungan Bulanan (PMT)
    // Kita asumsikan target menabung adalah sampai anak masuk KULIAH (atau jenjang terakhir).
    // Tapi untuk simplifikasi yang aman: Kita hitung PMT agar Total Dana terkumpul 
    // saat anak masuk jenjang PERTAMA yang dipilih? Tidak, itu terlalu berat.
    // Strategi: Hitung PMT rata-rata untuk mencapai Total Future Cost dalam rentang waktu terpanjang (Kuliah).
    
    // Cari stage dengan yearsToStart paling lama (biasanya PT)
    const maxYears = Math.max(...stages.map(s => s.yearsToStart));
    const monthsToSave = maxYears * 12;
    
    let monthlySaving = 0;
    if (monthsToSave > 0) {
        const monthlyRate = (returnRate / 100) / 12;
        monthlySaving = calculatePMT(monthlyRate, monthsToSave, 0, totalFutureCost);
    }

    return {
        totalFutureCost,
        monthlySaving,
        stagesDetail
    };
};