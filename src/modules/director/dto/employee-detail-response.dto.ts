import { ApiProperty } from '@nestjs/swagger';
import { HealthStatus } from '@prisma/client';

// ============================================================================
// 1. SUB-DTO: HEADER PROFIL KARYAWAN
// ============================================================================
export class EmployeeProfileDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID unik karyawan (UUID)' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso', description: 'Nama lengkap karyawan' })
  fullName: string;

  @ApiProperty({ example: 'Divisi Teknologi Informasi', description: 'Nama unit kerja/divisi' })
  unitName: string;

  @ApiProperty({ example: 'budi@pamjaya.co.id', description: 'Email korporat karyawan' })
  email: string;

  @ApiProperty({ enum: HealthStatus, example: 'BAHAYA', description: 'Status kesehatan finansial saat ini' })
  status: HealthStatus;

  @ApiProperty({ example: 45, description: 'Skor kesehatan finansial (0-100)' })
  healthScore: number;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z', description: 'Waktu checkup terakhir dilakukan' })
  lastCheckDate: Date;
}

// ============================================================================
// 2. SUB-DTO: HASIL ANALISA (SUMMARY)
// ============================================================================
export class FinancialAnalysisDto {
  @ApiProperty({ example: 45, description: 'Skor akhir hasil kalkulasi' })
  score: number;

  @ApiProperty({ enum: HealthStatus, example: 'BAHAYA', description: 'Status global hasil checkup' })
  globalStatus: HealthStatus;

  @ApiProperty({ example: 500000000, description: 'Total Kekayaan Bersih (Net Worth)' })
  netWorth: number;

  @ApiProperty({ example: -2000000, description: 'Surplus/Defisit Arus Kas Bulanan' })
  surplusDeficit: number;

  @ApiProperty({ description: 'Waktu analisa ini digenerate' })
  generatedAt: Date;

  @ApiProperty({ 
    description: 'Detail rasio finansial (Array of Objects dari engine)',
    example: [
      { id: 'saving_ratio', label: 'Rasio Tabungan', value: 5, grade: 'POOR', statusColor: 'RED' }
    ]
  })
  ratios: any; // Menggunakan 'any' karena struktur JSON dinamis dari financial engine
}

// ============================================================================
// 3. SUB-DTO: DATA MENTAH (FINANCIAL RECORD)
// ============================================================================
class UserProfileDataDto {
  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: '1985-08-17', required: false })
  dob?: string;
}

export class FinancialRecordDataDto {
  @ApiProperty({ type: UserProfileDataDto, description: 'Snapshot data profil saat checkup' })
  userProfile: UserProfileDataDto;

  // --- A. ASET LIKUID ---
  @ApiProperty({ example: 10000000 }) assetCash: number;

  // --- B. ASET PERSONAL ---
  @ApiProperty({ example: 500000000 }) assetHome: number;
  @ApiProperty({ example: 150000000 }) assetVehicle: number;
  @ApiProperty({ example: 5000000 }) assetJewelry: number;
  @ApiProperty({ example: 0 }) assetAntique: number;
  @ApiProperty({ example: 2000000 }) assetPersonalOther: number;

  // --- C. ASET INVESTASI ---
  @ApiProperty({ example: 0 }) assetInvHome: number;
  @ApiProperty({ example: 0 }) assetInvVehicle: number;
  @ApiProperty({ example: 10000000 }) assetGold: number;
  @ApiProperty({ example: 0 }) assetInvAntique: number;
  @ApiProperty({ example: 5000000 }) assetStocks: number;
  @ApiProperty({ example: 15000000 }) assetMutualFund: number;
  @ApiProperty({ example: 0 }) assetBonds: number;
  @ApiProperty({ example: 20000000 }) assetDeposit: number;
  @ApiProperty({ example: 0 }) assetInvOther: number;

  // --- D. UTANG KONSUMTIF ---
  @ApiProperty({ example: 300000000 }) debtKPR: number;
  @ApiProperty({ example: 50000000 }) debtKPM: number;
  @ApiProperty({ example: 5000000 }) debtCC: number;
  @ApiProperty({ example: 0 }) debtCoop: number;
  @ApiProperty({ example: 0 }) debtConsumptiveOther: number;

  // --- E. UTANG USAHA ---
  @ApiProperty({ example: 0 }) debtBusiness: number;

  // --- F. PENGHASILAN ---
  @ApiProperty({ example: 15000000 }) incomeFixed: number;
  @ApiProperty({ example: 2000000 }) incomeVariable: number;

  // --- G. CICILAN UTANG (PENGELUARAN) ---
  @ApiProperty({ example: 3500000 }) installmentKPR: number;
  @ApiProperty({ example: 1500000 }) installmentKPM: number;
  @ApiProperty({ example: 500000 }) installmentCC: number;
  @ApiProperty({ example: 0 }) installmentCoop: number;
  @ApiProperty({ example: 0 }) installmentConsumptiveOther: number;
  @ApiProperty({ example: 0 }) installmentBusiness: number;

  // --- H. ASURANSI (PENGELUARAN) ---
  @ApiProperty({ example: 500000 }) insuranceLife: number;
  @ApiProperty({ example: 750000 }) insuranceHealth: number;
  @ApiProperty({ example: 0 }) insuranceHome: number;
  @ApiProperty({ example: 0 }) insuranceVehicle: number;
  @ApiProperty({ example: 200000 }) insuranceBPJS: number;
  @ApiProperty({ example: 0 }) insuranceOther: number;

  // --- I. TABUNGAN & INVESTASI RUTIN (PENGELUARAN) ---
  @ApiProperty({ example: 1000000 }) savingEducation: number;
  @ApiProperty({ example: 1000000 }) savingRetirement: number;
  @ApiProperty({ example: 0 }) savingPilgrimage: number;
  @ApiProperty({ example: 0 }) savingHoliday: number;
  @ApiProperty({ example: 500000 }) savingEmergency: number;
  @ApiProperty({ example: 0 }) savingOther: number;

  // --- J. PENGELUARAN RUTIN LAINNYA ---
  @ApiProperty({ example: 3000000 }) expenseFood: number;
  @ApiProperty({ example: 1500000 }) expenseSchool: number;
  @ApiProperty({ example: 1000000 }) expenseTransport: number;
  @ApiProperty({ example: 500000 }) expenseCommunication: number;
  @ApiProperty({ example: 0 }) expenseHelpers: number;
  @ApiProperty({ example: 0 }) expenseTax: number;
  @ApiProperty({ example: 1000000 }) expenseLifestyle: number;
}

// ============================================================================
// 4. WRAPPER UTAMA (RESPONSE DTO)
// ============================================================================
export class EmployeeAuditDetailDto {
  @ApiProperty({ type: EmployeeProfileDto, description: 'Informasi identitas dan status audit karyawan' })
  profile: EmployeeProfileDto;

  @ApiProperty({ type: FinancialAnalysisDto, description: 'Hasil analisa dan skor kesehatan finansial' })
  analysis: FinancialAnalysisDto;

  @ApiProperty({ type: FinancialRecordDataDto, description: 'Data mentah inputan financial checkup' })
  record: FinancialRecordDataDto;
}