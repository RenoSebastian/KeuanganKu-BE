// File: src/modules/financial/utils/financial-math.util.ts

import { CreateFinancialRecordDto } from '../dto/create-financial-record.dto';
import { CreatePensionDto } from '../dto/create-pension.dto';
// [UPDATED] Import Simulation DTO untuk Asuransi
import { CreateInsuranceDto } from '../dto/create-insurance.dto';
import { CreateInsuranceSimulationDto } from '../dto/create-insurance-simulation.dto';
import { CreateGoalDto, SimulateGoalDto } from '../dto/create-goal.dto';
import { CreateEducationPlanDto } from '../dto/create-education.dto';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { SchoolLevel, CostType } from '@prisma/client';
import { RiskAnswerOption } from '../dto/calculate-risk-profile.dto';
import { RiskProfileAnswerItemDto } from '../dto/create-risk-profile-simulation.dto';
import {
  RiskProfileCategory,
  RiskAllocationDto,
} from '../dto/risk-profile-response.dto';

// Hapus import konstanta BUDGET_ALLOCATION_RULES jika ingin full dynamic,
// tapi untuk alokasi budget (45/20/15/10/10) biasanya jarang berubah, jadi boleh di-keep atau dipindah ke DB juga.
// Di sini saya keep sebagai default logic.
import { BUDGET_ALLOCATION_RULES } from '../constants/budgeting-rules.constant';

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
  const totalAnnualIncome =
    (val(data.incomeFixed) + val(data.incomeVariable)) * 12;

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
    totalConsumptiveInstallment + val(data.installmentBusiness) * 12;

  // Total Premi Asuransi (L)
  const totalInsurance =
    (val(data.insuranceLife) +
      val(data.insuranceHealth) +
      val(data.insuranceHome) +
      val(data.insuranceVehicle) +
      val(data.insuranceBPJS) +
      val(data.insuranceOther)) *
    12;

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
  let rec1 =
    'Dana darurat Anda belum ideal. Disarankan mulai membangun dana darurat secara bertahap dari penghasilan bulanan hingga mencapai minimal 3–6 kali pengeluaran.';

  if (r1 >= 3 && r1 <= 6) {
    s1 = 'GREEN_DARK';
    rec1 =
      'Dana darurat Anda berada pada kondisi ideal dan telah memberikan perlindungan keuangan yang memadai.';
  } else if (r1 > 6 && r1 <= 12) {
    s1 = 'GREEN_LIGHT';
    rec1 =
      'Kondisi dana darurat masih tergolong baik. Apabila Anda belum memiliki investasi, sebagian dana ini dapat mulai dialokasikan ke instrumen investasi berisiko rendah–menengah seperti obligasi atau logam mulia.';
  } else if (r1 > 12) {
    s1 = 'YELLOW';
    rec1 =
      'Dana darurat Anda sangat memadai. Apabila belum memiliki investasi, disarankan mengalokasikan sebagian dana ke instrumen investasi jangka menengah–panjang seperti reksa dana atau saham.';
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
  let rec2 =
    'Likuiditas Anda kurang ideal. Disarankan meningkatkan aset likuid agar keuangan lebih fleksibel dan aman terhadap kondisi darurat.';

  if (r2 > 50) {
    s2 = 'GREEN_DARK'; // Logic disesuaikan agar >50% hijau tua (sangat likuid)
    rec2 =
      'Likuiditas Anda sangat tinggi. Kondisi ini aman, namun dapat menjadi kurang optimal apabila dana terlalu banyak mengendap dan belum dimanfaatkan untuk investasi.';
  } else if (r2 >= 15) {
    // Benchmark Min 15%
    s2 = 'GREEN_LIGHT';
    rec2 =
      'Kondisi likuiditas tergolong sangat baik dan seimbang antara keamanan dan potensi pertumbuhan.';
  } else if (r2 >= 10) {
    s2 = 'YELLOW';
    rec2 =
      'Likuiditas Anda berada pada batas ideal minimum dan masih dalam kondisi sehat.';
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
  let rec3 =
    'Rasio tabungan belum ideal. Disarankan meninjau kembali pengeluaran dan mulai meningkatkan porsi tabungan secara bertahap.';

  if (r3 >= 30) {
    s3 = 'GREEN_DARK';
    rec3 =
      'Tingkat menabung sangat baik. Anda memiliki disiplin keuangan yang kuat dan ruang yang besar untuk mencapai tujuan finansial lebih cepat.';
  } else if (r3 >= 20) {
    s3 = 'GREEN_LIGHT';
    rec3 =
      'Rasio tabungan tergolong baik dan menunjukkan perencanaan keuangan yang matang.';
  } else if (r3 <= 10) {
    s3 = 'YELLOW';
    rec3 =
      'Rasio tabungan sudah memenuhi standar minimal dan berada pada kondisi sehat.';
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

  if (r4 <= 15) {
    s4 = 'GREEN_DARK';
    rec4 = 'Struktur utang sangat sehat dan risiko keuangan relatif rendah.';
  } else if (r4 <= 35) {
    s4 = 'GREEN_LIGHT';
    rec4 = 'Struktur utang masih aman dan berada dalam kondisi yang terkontrol.';
  } else if (r4 <= 50) {
    s4 = 'YELLOW';
    rec4 =
      'Utang mulai mendekati batas ideal. Disarankan berhati-hati dalam menambah utang baru.';
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
  let rec5 =
    'Beban cicilan masih dalam batas wajar, namun perlu dikelola dengan disiplin.';

  if (r5 < 10) {
    s5 = 'GREEN_DARK';
    rec5 =
      'Beban cicilan sangat ringan dan memberikan ruang besar untuk menabung dan berinvestasi.';
  } else if (r5 <= 15) {
    s5 = 'GREEN_LIGHT';
    rec5 = 'Beban cicilan masih sangat aman dan sehat.';
  } else if (r5 <= 35) {
    s5 = 'YELLOW';
    rec5 =
      'Beban cicilan masih dalam batas wajar, namun perlu dikelola dengan disiplin.';
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
  let rec6 =
    'Utang konsumtif terlalu tinggi dan berisiko mengganggu kesehatan keuangan jangka panjang.';

  if (r6 <= 5) {
    s6 = 'GREEN_DARK';
    rec6 =
      'Utang konsumtif sangat terkendali dan menunjukkan perilaku keuangan yang disiplin.';
  } else if (r6 <= 10) {
    s6 = 'GREEN_LIGHT';
    rec6 = 'Utang konsumtif masih dalam kondisi aman.';
  } else if (r6 <= 15) {
    s6 = 'YELLOW';
    rec6 =
      'Utang konsumtif mendekati batas ideal. Perlu pengendalian agar tidak meningkat.';
  } else {
    s6 = 'RED';
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
  let rec7 =
    'Sebagian besar kekayaan belum produktif. Perlu perencanaan investasi yang lebih terstruktur.';

  if (r7 >= 50) {
    s7 = 'GREEN_DARK';
    rec7 =
      'Struktur kekayaan sangat produktif dan mendukung tujuan keuangan jangka panjang.';
  } else if (r7 >= 25) {
    s7 = 'GREEN_LIGHT';
    rec7 =
      'Kondisi cukup baik, namun masih ada ruang untuk meningkatkan porsi aset produktif.';
  } else if (r7 >= 10) {
    s7 = 'YELLOW'; // Warning jika di bawah 50 tapi diatas 25
    rec7 =
      'Aset produktif masih relatif kecil. Disarankan mulai meningkatkan investasi secara bertahap.';
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
  let rec8 =
    'Risiko keuangan tinggi. Diperlukan perencanaan keuangan yang lebih serius dan terarah.';

  if (r8 >= 75) {
    s8 = 'GREEN_DARK';
    rec8 =
      'Kondisi solvabilitas sangat kuat dan risiko kebangkrutan sangat rendah.';
  } else if (r8 >= 50) {
    s8 = 'GREEN_LIGHT';
    rec8 = 'Kondisi solvabilitas baik dan masih dalam batas aman.';
  } else if (r8 >= 25) {
    s8 = 'YELLOW';
    rec8 =
      'Kondisi mulai rentan. Disarankan memperkuat aset atau mengurangi utang.';
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

  // =================================================================
  // 3. HITUNG SKOR KESEHATAN (WEIGHTED DISTRIBUTION LOGIC)
  // =================================================================

  // A. Definisikan Bobot Nilai (0-100)
  // Logic: Hijau mengangkat nilai, Merah menjatuhkan nilai secara signifikan
  const SCORE_WEIGHTS: Record<string, number> = {
    GREEN_DARK: 100, // Sempurna
    GREEN_LIGHT: 85, // Sehat
    YELLOW: 50, // Waspada (Setengah lulus)
    RED: 15, // Bahaya (Nilai sangat rendah)
  };

  // B. Hitung Total Poin dari semua Rasio
  let totalPoints = 0;
  const totalRatios = ratios.length;

  // Variabel bantu untuk counting (opsional, untuk debug)
  let redCount = 0;

  ratios.forEach((r) => {
    // Ambil bobot berdasarkan warna, default 0 jika error
    const points = SCORE_WEIGHTS[r.statusColor] || 0;
    totalPoints += points;

    if (r.statusColor === 'RED') redCount++;
  });

  // C. Kalkulasi Final Score (Rata-rata)
  // Rumus: Total Poin / Jumlah Rasio
  let score = totalRatios > 0 ? Math.round(totalPoints / totalRatios) : 0;

  // D. Tentukan Status Global berdasarkan Range Nilai
  let globalStatus: 'SEHAT' | 'WASPADA' | 'BAHAYA';

  if (score >= 80) {
    // Skor >= 80: SEHAT (Mayoritas Hijau)
    globalStatus = 'SEHAT';
  } else if (score >= 50) {
    // Skor 50 - 79: WASPADA (Campuran Hijau/Kuning atau ada sedikit Merah)
    globalStatus = 'WASPADA';
  } else {
    // Skor < 50: BAHAYA (Dominan Merah/Kuning)
    globalStatus = 'BAHAYA';
  }

  // --- LOGIC TAMBAHAN (SAFETY NET) ---
  // Jika skor masuk kategori "SEHAT" (misal 81), TAPI ada lebih dari 2 indikator MERAH,
  // kita paksa turun ke "WASPADA" agar user tidak terlena.
  if (globalStatus === 'SEHAT' && redCount >= 2) {
    globalStatus = 'WASPADA';
    score = 79; // Cap di batas atas Waspada
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
    incomeVariable: val(data.incomeVariable),
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
export const calculateFV = (
  rate: number,
  nper: number,
  pmt: number,
  pv: number,
  type: 0 | 1 = 0,
) => {
  if (rate === 0) return -(pv + pmt * nper);
  const pow = Math.pow(1 + rate, nper);
  return -((pv * pow) + (pmt * (1 + rate * type) * (pow - 1)) / rate);
};

/**
 * Menghitung PMT (Anuitas / Tabungan Rutin)
 * @param rate Rate per periode (bukan persen, misal 0.08/12)
 * @param nper Jumlah periode (bulan)
 * @param pv Nilai sekarang (modal awal)
 * @param fv Nilai masa depan yang diinginkan
 * @param type 0 = akhir periode, 1 = awal periode
 */
export const calculatePMT = (
  rate: number,
  nper: number,
  pv: number,
  fv: number = 0,
  type: 0 | 1 = 0,
) => {
  if (rate === 0) return -(pv + fv) / nper;
  const pvif = Math.pow(1 + rate, nper);
  return -((rate * (fv + pv * pvif)) / ((pvif - 1) * (1 + rate * type)));
};

/**
 * Kalkulasi Pensiun (Matches Excel "Kalkulator Dana Hari Tua_Rev1.xlsx")
 * [DYNAMIC] Parameter inflationRate & returnRate sekarang dinamis.
 */
export function calculatePensionPlan(data: {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentExpense: number;
  currentSaving: number;
  inflationRate?: number; // Optional, default to 5 if undefined
  returnRate?: number; // Optional, default to 10 if undefined
}) {
  // Fallback Values (Safety Net)
  const inflRateVal = data.inflationRate ?? 5.0;
  const retRateVal = data.returnRate ?? 10.0;

  // 1. Parameter Waktu
  const yearsToRetire = Math.max(1, data.retirementAge - data.currentAge); // n1
  const retirementDuration = Math.max(
    1,
    data.lifeExpectancy - data.retirementAge,
  ); // n2

  // 2. Konversi Rate (Excel Logic: r = i - f)
  const infRate = inflRateVal / 100;
  const invRate = retRateVal / 100;
  const nettRate = invRate - infRate; // Simple Subtraction (Sesuai Excel)

  // 3. Future Value Expense (Biaya Hidup saat Pensiun)
  // Rumus: PV * (1 + f)^n1
  const futureMonthlyExpense =
    data.currentExpense * Math.pow(1 + infRate, yearsToRetire);
  const futureAnnualExpense = futureMonthlyExpense * 12;

  // 4. Total Fund Needed (Gunung Emas) - PVAD Method
  // Menggunakan Nett Rate untuk mengakomodasi kenaikan biaya hidup selama masa pensiun
  // Rumus PVAD: PMT * [ (1 - (1+r)^-n2) / r ] * (1+r)
  let totalFundNeeded = 0;
  if (nettRate === 0) {
    totalFundNeeded = futureAnnualExpense * retirementDuration;
  } else {
    const factor = (1 - Math.pow(1 + nettRate, -retirementDuration)) / nettRate;
    totalFundNeeded = futureAnnualExpense * factor * (1 + nettRate);
  }

  // 5. Future Value Existing Fund (Aset Lama)
  // Menggunakan Rate Konstan 5.5% (0.055) untuk aset yang sudah ada, atau bisa dibuat dinamis nanti
  const FIXED_EXISTING_RATE = 0.055;
  const fvExistingFund =
    data.currentSaving * Math.pow(1 + FIXED_EXISTING_RATE, yearsToRetire);

  // 6. Shortfall (Gap)
  // Menghitung selisih antara Kebutuhan vs Aset Lama yang sudah tumbuh
  const shortfall = Math.max(0, totalFundNeeded - fvExistingFund);

  // 7. Monthly Saving (PMT)
  // Menghitung cicilan untuk mencapai Shortfall (menggunakan return rate input user)
  let monthlySaving = 0;
  if (shortfall > 0) {
    const monthlyRate = invRate / 12;
    const months = yearsToRetire * 12;

    if (monthlyRate === 0) {
      monthlySaving = shortfall / months;
    } else {
      // Rumus PMT Future Value: FV * r / ((1+r)^n - 1)
      monthlySaving =
        (shortfall * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
    }
  }

  return {
    yearsToRetire,
    retirementDuration,
    futureMonthlyExpense, // Untuk Shock Therapy UI
    totalFundNeeded, // Target Dana
    fvExistingFund, // Aset Lama (Tumbuh 5.5%)
    shortfall, // Kekurangan
    monthlySaving, // Solusi
  };
}

/**
 * CALCULATOR: INSURANCE PLAN (Income Replacement Method)
 * Sebagai analis, kita memisahkan kebutuhan menjadi 3 pilar:
 * 1. Income Replacement (Living Cost)
 * 2. Debt Clearance (Liability)
 * 3. Final Expense (Funeral & Emergency)
 * * [UPDATED] Menerima Union Type (CreateInsuranceDto | CreateInsuranceSimulationDto)
 * agar bisa dipakai oleh fitur Database maupun Stateless.
 */
export const calculateInsurancePlan = (
  data: CreateInsuranceDto | CreateInsuranceSimulationDto,
) => {
  const {
    monthlyExpense,
    existingDebt = 0,
    existingCoverage = 0,
    protectionDuration = 10,
    inflationRate = 5,
    returnRate = 7,
    finalExpense = 0,
  } = data;

  // 1. Hitung Bunga Riil / Nett Rate (r)
  // Nett interest = Target investasi - Inflasi (Real Rate of Return)
  const iRate = inflationRate / 100;
  const rRate = returnRate / 100;
  const nettRate = rRate - iRate;

  // 2. Hitung Income Replacement (PVAD - Present Value Annuity Due)
  // Income tahunan yang harus digantikan untuk menjaga standar hidup keluarga
  const annualExpense = monthlyExpense * 12;
  const n = protectionDuration;

  let incomeReplacementValue = 0;

  if (nettRate === 0) {
    // KASUS KHUSUS: Jika Investasi == Inflasi (Nett Rate 0)
    // Hitungan linear sederhana: Pengeluaran Tahunan x Durasi
    incomeReplacementValue = annualExpense * n;
  } else {
    /**
     * RUMUS UTAMA (PVAD)
     * Kita menggunakan Annuity Due karena asumsi keluarga membutuhkan
     * dana di AWAL tahun untuk biaya hidup.
     * Rumus: PMT * [ (1 - (1+r)^-n) / r ] * (1+r)
     */
    const discountFactor = (1 - Math.pow(1 + nettRate, -n)) / nettRate;
    incomeReplacementValue =
      annualExpense * discountFactor * (1 + nettRate);
  }

  // 3. Debt Clearance (Pelunasan Hutang)
  const debtClearanceValue = existingDebt;

  /**
   * 4. Biaya Duka & Kebutuhan Akhir (Final Expense)
   * Sekarang nilai ini diambil secara murni dari input user,
   * bukan lagi 'Included' secara abstrak di dalam income replacement.
   */
  const otherNeeds = finalExpense;

  /**
   * 5. Total Kebutuhan UP (Gross)
   * Total = Dana Hidup + Pelunasan Hutang + Biaya Akhir Hayat
   * Sesuai prinsip 'Separation of Concerns', kita menjumlahkan 3 komponen yang berbeda.
   */
  const totalNeeded =
    incomeReplacementValue + debtClearanceValue + otherNeeds;

  // 6. Hitung Gap (Kekurangan Proteksi)
  // Total Kebutuhan - Aset/Asuransi yang Sudah Dimiliki
  const coverageGap = Math.max(0, totalNeeded - existingCoverage);

  // 7. Buat Rekomendasi Tekstual yang Akurat
  let recommendation = '';
  if (coverageGap <= 0) {
    recommendation =
      'Selamat! Nilai perlindungan asuransi Anda saat ini sudah mencukupi kebutuhan keluarga (Biaya Hidup, Hutang, & Biaya Duka).';
  } else {
    const formattedGap = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(coverageGap);

    recommendation = `Keluarga Anda membutuhkan dana tambahan sebesar ${formattedGap} untuk menjaga standar hidup selama ${n} tahun, melunasi hutang, serta mencadangkan biaya akhir hayat jika terjadi risiko.`;
  }

  return {
    // Rincian Granular untuk disajikan ke FE & PDF
    annualExpense, // Pengeluaran Tahunan
    nettRatePercentage: (nettRate * 100).toFixed(2), // Real Rate dalam %
    incomeReplacementValue, // Pilar 1: Dana Hidup (PVAD)
    debtClearanceValue, // Pilar 2: Dana Hutang
    otherNeeds, // Pilar 3: Biaya Duka/Pemakaman

    // Aggregated Results
    totalNeeded, // Total UP Ideal
    coverageGap, // Shortfall (Kekurangan)
    recommendation, // Saran Analis
  };
};

/**
 * LOGIKA: GOALS (TUJUAN KEUANGAN) - Create (Simpan)
 * Menghitung kebutuhan menabung bulanan untuk mencapai target dana di masa depan.
 */
export const calculateGoalPlan = (data: CreateGoalDto) => {
  const {
    targetAmount,
    targetDate,
    inflationRate = 5,
    returnRate = 6,
  } = data;

  const now = new Date();
  const target = new Date(targetDate);

  // 1. Hitung durasi bulan (nper)
  const monthsDuration =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());

  if (monthsDuration <= 0) {
    throw new Error('Target waktu harus di masa depan');
  }

  const yearsDuration = monthsDuration / 12;

  // 2. Hitung Nilai Masa Depan Target (FV akibat Inflasi)
  // Jika beli rumah 5 tahun lagi, harganya pasti naik kena inflasi
  const futureTargetAmount =
    targetAmount * Math.pow(1 + inflationRate / 100, yearsDuration);

  // 3. Hitung Tabungan Bulanan (PMT)
  const monthlyRate = returnRate / 100 / 12;

  // REVISI DISINI: Tambahkan Math.abs() agar output positif
  const monthlySaving = Math.abs(
    calculatePMT(
      monthlyRate,
      monthsDuration,
      0, // Mulai dari 0
      futureTargetAmount,
    ),
  );

  return {
    monthsDuration,
    futureTargetAmount, // Nilai target setelah inflasi
    monthlySaving,
  };
};

/**
 * LOGIKA: GOALS (SIMULASI)
 * Menghitung FV dan PMT berdasarkan Current Cost dan Tenor.
 * Digunakan untuk endpoint /financial/goals/simulate
 */
export const calculateGoalSimulation = (data: SimulateGoalDto) => {
  const { currentCost, years, inflationRate = 5, returnRate = 6 } = data;

  // 1. Hitung Future Value (FV)
  // Rumus: FV = PV * (1 + i)^n
  const iRate = inflationRate / 100;
  const futureValue = currentCost * Math.pow(1 + iRate, years);

  // 2. Hitung Monthly Saving (PMT)
  // Rumus PMT Annuity
  const monthlyRate = returnRate / 100 / 12;
  const months = years * 12;

  // calculatePMT(rate, nper, pv, fv)
  // pv = 0 (asumsi mulai dari nol)
  // fv = target dana masa depan
  const monthlySaving = Math.abs(
    calculatePMT(
      monthlyRate,
      months,
      0,
      futureValue,
    ),
  );

  return {
    futureValue,
    monthlySaving,
  };
};

/**
 * ------------------------------------------------------------------
 * UPDATE UTAMA: DANA PENDIDIKAN (GRANULAR SINKING FUND)
 * ------------------------------------------------------------------
 * Menggunakan metode "Cashflow Matching" sesuai Dokumen Referensi.
 * Setiap jenjang dihitung mandiri (Sinking Fund terpisah), lalu dijumlahkan.
 */
export function calculateEducationPlan(dto: CreateEducationPlanDto) {
  const inflationRate = (dto.inflationRate || 10) / 100;
  const returnRate = (dto.returnRate || 12) / 100;

  // Rate investasi bulanan untuk rumus PMT
  const rRateMonthly = returnRate / 12;

  const stagesBreakdown = dto.stages.map((stage) => {
    let futureCost = 0;

    // --- CORE LOGIC UPDATE START ---

    // 1. LOGIC S2 (MAGISTER) - SINGLE COST RULE
    // User Requirement: "S2 hanya menghitung satu kali biaya kuliah dari awal masuk"
    if (stage.level === SchoolLevel.S2) {
      // Rumus: FV = PV * (1 + inflasi)^tahun
      // Tidak peduli apakah user input ANNUAL/ENTRY, S2 dianggap Lump Sum 1x.
      futureCost = Number(stage.currentCost) * Math.pow(1 + inflationRate, stage.yearsToStart);
    }

    // 2. LOGIC S1 (SARJANA) - 4 YEARS / 8 SEMESTERS RULE
    // User Requirement: "S1 menghitung dari semester 1 hingga 8"
    else if (stage.level === SchoolLevel.S1 && stage.costType === CostType.ANNUAL) {
      // Asumsi: Input currentCost adalah "Biaya Per Tahun".
      // Kita harus mengakumulasi biaya selama 4 tahun kuliah.
      // Tahun ke-1: Kena inflasi selama (yearsToStart) tahun
      // Tahun ke-2: Kena inflasi selama (yearsToStart + 1) tahun
      // dst...

      const durationS1 = 4; // 4 Tahun (8 Semester)

      let totalS1Cost = 0;

      for (let i = 0; i < durationS1; i++) {
        const yearInflation = stage.yearsToStart + i;
        const costPerYear =
          Number(stage.currentCost) * Math.pow(1 + inflationRate, yearInflation);
        totalS1Cost += costPerYear;
      }

      futureCost = totalS1Cost;
    }

    // 3. LOGIC UMUM (TK, SD, SMP, SMA, atau Uang Pangkal S1)
    else {
      // Perhitungan standar Single FV
      futureCost =
        Number(stage.currentCost) *
        Math.pow(1 + inflationRate, stage.yearsToStart);
    }

    // --- CORE LOGIC UPDATE END ---

    // Hitung Tabungan Bulanan (PMT)
    // Jika yearsToStart 0 (masuk tahun ini), PMT = 0 (karena butuh dana tunai sekarang)
    // Sebaiknya UI menangani ini sebagai "Dana Darurat", tapi disini kita return 0 saving.
    let monthlySavingItem = 0;
    const months = stage.yearsToStart * 12;

    if (months > 0) {
      // Menggunakan Math.abs agar hasil positif
      monthlySavingItem = Math.abs(calculatePMT(rRateMonthly, months, 0, futureCost));
    }

    return {
      ...stage,
      futureCost, // Nilai masa depan yang sudah disesuaikan logic S1/S2
      monthlySaving: monthlySavingItem,
    };
  });

  // Agregasi Total
  const totalFutureCost = stagesBreakdown.reduce(
    (acc, item) => acc + item.futureCost,
    0,
  );
  const totalMonthlySaving = stagesBreakdown.reduce(
    (acc, item) => acc + item.monthlySaving,
    0,
  );

  return {
    totalFutureCost,
    monthlySaving: totalMonthlySaving,
    stagesBreakdown,
  };
}

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

// ===========================================================================
// [NEW] RISK PROFILE CALCULATION ENGINE
// ===========================================================================

export interface RiskAnalysisResult {
  totalScore: number;
  profile: RiskProfileCategory;
  description: string;
  allocation: RiskAllocationDto;
}

export const calculateRiskProfileAnalysis = (
  answers: RiskProfileAnswerItemDto[],
): RiskAnalysisResult => {
  // 1. Hitung Total Skor
  // Asumsi: Frontend mengirim 'value' yang sudah merupakan bobot (misal: 10, 20, 30, 40)
  const totalScore = answers.reduce((acc, item) => acc + Number(item.value), 0);

  let profile: RiskProfileCategory;
  let description: string;
  let allocation: RiskAllocationDto;

  // 2. Klasifikasi Berdasarkan Range Skor
  // Note: Range ini bisa disesuaikan dengan aturan bisnis perusahaan Anda
  // Total Skor Maksimal tergantung jumlah soal (misal 10 soal x 4 poin = 40)

  if (totalScore < 20) {
    // --- KONSERVATIF ---
    profile = RiskProfileCategory.KONSERVATIF;
    description =
      'Anda cenderung menghindari risiko dan lebih memprioritaskan keamanan modal pokok (Principal Protection) daripada imbal hasil tinggi. Anda merasa tidak nyaman dengan fluktuasi pasar jangka pendek.';
    allocation = {
      // [FIX] Menggunakan key '...Risk' agar konsisten dengan DTO
      lowRisk: 80, // Pasar Uang / Deposito
      mediumRisk: 20, // Obligasi
      highRisk: 0, // Saham
    };
  } else if (totalScore >= 20 && totalScore < 35) {
    // --- MODERAT ---
    profile = RiskProfileCategory.MODERAT;
    description =
      'Anda bersedia menerima fluktuasi jangka pendek demi mendapatkan potensi keuntungan yang lebih baik daripada deposito. Anda mencari keseimbangan antara pertumbuhan modal dan stabilitas.';
    allocation = {
      lowRisk: 20,
      mediumRisk: 50,
      highRisk: 30,
    };
  } else {
    // --- AGRESIF ---
    profile = RiskProfileCategory.AGRESIF;
    description =
      'Anda memiliki toleransi tinggi terhadap risiko dan fluktuasi pasar yang tajam. Tujuan utama Anda adalah pertumbuhan modal maksimal dalam jangka panjang (Capital Gain).';
    allocation = {
      lowRisk: 0,
      mediumRisk: 20,
      highRisk: 80,
    };
  }

  return {
    totalScore,
    profile,
    description,
    allocation,
  };
};

// ===========================================================================
// [NEW] AGENT SIMULATION ENGINE
// ===========================================================================

/**
 * Interface untuk Output Simulasi Agen
 */
export interface AgentBudgetSimulationResult {
  meta: {
    totalIncome: number;
    fixedIncome: number;
    variableIncome: number;
  };
  allocation: {
    livingCost: number; // 45%
    debtConsumptive: number; // 15%
    debtProductive: number; // 20%
    insurance: number; // 10%
    saving: number; // 10%
  };
  analysis: {
    totalRecommendedSavings: number; // Saving (Fixed) + Variable Income
    variableIncomeRecommendation: string;
    notes: string[]; // Catatan tambahan untuk agen
  };
}

/**
 * calculateAgentBudgetSimulation
 * ------------------------------
 * Core Logic untuk fitur Simulasi Anggaran oleh Agen.
 * * Logic Workflow:
 * 1. Gaji Tetap (Fixed Income) dialokasikan menggunakan persentase baku (45/15/20/10/10).
 * 2. Gaji Variabel (Variable Income) TIDAK dipecah, melainkan disarankan masuk 100% ke Surplus/Tabungan.
 * * @param fixedIncome Pendapatan tetap bulanan (Basis Perhitungan)
 * @param variableIncome Pendapatan tidak tetap (Opsional, Default 0)
 */
export const calculateAgentBudgetSimulation = (
  fixedIncome: number,
  variableIncome: number = 0,
): AgentBudgetSimulationResult => {
  // 1. Validasi Input (Defensive Programming)
  const baseIncome = Math.max(0, Number(fixedIncome));
  const extraIncome = Math.max(0, Number(variableIncome));
  const totalIncome = baseIncome + extraIncome;

  // 2. Hitung Alokasi berdasarkan Gaji Tetap
  const livingCost = baseIncome * BUDGET_ALLOCATION_RULES.LIVING_COST;
  const debtConsumptive = baseIncome * BUDGET_ALLOCATION_RULES.DEBT_CONSUMPTIVE_MAX;
  const debtProductive = baseIncome * BUDGET_ALLOCATION_RULES.DEBT_PRODUCTIVE_MAX;
  const insurance = baseIncome * BUDGET_ALLOCATION_RULES.INSURANCE_MIN;
  const savingFromFixed = baseIncome * BUDGET_ALLOCATION_RULES.SAVING_MIN;

  // 3. Logic Gaji Variabel -> Masuk ke Tabungan/Surplus
  const totalRecommendedSavings = savingFromFixed + extraIncome;

  // 4. Generate Recommendation String
  let variableIncomeRecommendation = 'Tidak ada pendapatan variabel.';
  const notes: string[] = [];

  if (extraIncome > 0) {
    const formattedExtra = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(extraIncome);
    variableIncomeRecommendation = `Klien memiliki pendapatan tidak tetap sebesar ${formattedExtra}. Disarankan dana ini dialokasikan 100% untuk Tabungan, Dana Darurat, atau Top-up Investasi untuk mempercepat pencapaian tujuan finansial.`;
    notes.push(
      'Pendapatan variabel dianggap sebagai surplus untuk memperkuat pos tabungan.',
    );
  }

  // 5. Construct Result Object
  return {
    meta: {
      totalIncome,
      fixedIncome: baseIncome,
      variableIncome: extraIncome,
    },
    allocation: {
      livingCost,
      debtConsumptive,
      debtProductive,
      insurance,
      saving: savingFromFixed, // Ini hanya porsi dari gaji tetap
    },
    analysis: {
      totalRecommendedSavings, // Ini gabungan (Fixed Saving + Variable Income)
      variableIncomeRecommendation,
      notes,
    },
  };
};
