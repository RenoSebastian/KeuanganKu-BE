import { ApiProperty } from '@nestjs/swagger';
import { HealthStatus } from '@prisma/client';

// ============================================================================
// 1. SUB-DTO: HEADER PROFIL KARYAWAN
// ============================================================================
export class EmployeeProfileDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso' })
  fullName: string;

  @ApiProperty({ example: 'Divisi Teknologi Informasi' })
  unitName: string;

  @ApiProperty({ example: 'budi@pamjaya.co.id' })
  email: string;

  @ApiProperty({ enum: HealthStatus, example: 'BAHAYA' })
  status: HealthStatus;

  @ApiProperty({ example: 45, description: 'Skor kesehatan finansial (0-100)' })
  healthScore: number;

  @ApiProperty({ example: '2026-01-24T10:00:00.000Z' })
  lastCheckDate: Date;
}

// ============================================================================
// 2. SUB-DTO: HASIL ANALISA (SUMMARY)
// ============================================================================
export class FinancialAnalysisDto {
  @ApiProperty({ example: 45 })
  score: number;

  @ApiProperty({ enum: HealthStatus, example: 'BAHAYA' })
  globalStatus: HealthStatus;

  @ApiProperty({ example: 500000000, description: 'Total Kekayaan Bersih' })
  netWorth: number;

  @ApiProperty({ example: -2000000, description: 'Surplus/Defisit Bulanan' })
  surplusDeficit: number;

  @ApiProperty()
  generatedAt: Date;

  @ApiProperty({ 
    description: 'Detail rasio finansial (JSON dynamic)',
    example: [
      { id: 'saving_ratio', label: 'Rasio Tabungan', value: 5, grade: 'POOR' }
    ]
  })
  ratios: any; // Menggunakan 'any' karena struktur JSON dinamis dari engine
}

// ============================================================================
// 3. SUB-DTO: DATA MENTAH (FINANCIAL RECORD)
// ============================================================================
class UserProfileDataDto {
  @ApiProperty({ example: 'Budi Santoso' })
  name: string;

  @ApiProperty({ example: '1985-08-17' })
  dob?: string;
}

export class FinancialRecordDataDto {
  @ApiProperty({ type: UserProfileDataDto })
  userProfile: UserProfileDataDto;

  // --- A. ASET LIKUID ---
  @ApiProperty() assetCash: number;

  // --- B. ASET PERSONAL ---
  @ApiProperty() assetHome: number;
  @ApiProperty() assetVehicle: number;
  @ApiProperty() assetJewelry: number;
  @ApiProperty() assetAntique: number;
  @ApiProperty() assetPersonalOther: number;

  // --- C. ASET INVESTASI ---
  @ApiProperty() assetInvHome: number;
  @ApiProperty() assetInvVehicle: number;
  @ApiProperty() assetGold: number;
  @ApiProperty() assetInvAntique: number;
  @ApiProperty() assetStocks: number;
  @ApiProperty() assetMutualFund: number;
  @ApiProperty() assetBonds: number;
  @ApiProperty() assetDeposit: number;
  @ApiProperty() assetInvOther: number;

  // --- D. UTANG KONSUMTIF ---
  @ApiProperty() debtKPR: number;
  @ApiProperty() debtKPM: number;
  @ApiProperty() debtCC: number;
  @ApiProperty() debtCoop: number;
  @ApiProperty() debtConsumptiveOther: number;

  // --- E. UTANG USAHA ---
  @ApiProperty() debtBusiness: number;

  // --- F. PENGHASILAN ---
  @ApiProperty() incomeFixed: number;
  @ApiProperty() incomeVariable: number;

  // --- G. CICILAN UTANG ---
  @ApiProperty() installmentKPR: number;
  @ApiProperty() installmentKPM: number;
  @ApiProperty() installmentCC: number;
  @ApiProperty() installmentCoop: number;
  @ApiProperty() installmentConsumptiveOther: number;
  @ApiProperty() installmentBusiness: number;

  // --- H. ASURANSI ---
  @ApiProperty() insuranceLife: number;
  @ApiProperty() insuranceHealth: number;
  @ApiProperty() insuranceHome: number;
  @ApiProperty() insuranceVehicle: number;
  @ApiProperty() insuranceBPJS: number;
  @ApiProperty() insuranceOther: number;

  // --- I. TABUNGAN & INVESTASI RUTIN ---
  @ApiProperty() savingEducation: number;
  @ApiProperty() savingRetirement: number;
  @ApiProperty() savingPilgrimage: number;
  @ApiProperty() savingHoliday: number;
  @ApiProperty() savingEmergency: number;
  @ApiProperty() savingOther: number;

  // --- J. PENGELUARAN RUTIN ---
  @ApiProperty() expenseFood: number;
  @ApiProperty() expenseSchool: number;
  @ApiProperty() expenseTransport: number;
  @ApiProperty() expenseCommunication: number;
  @ApiProperty() expenseHelpers: number;
  @ApiProperty() expenseTax: number;
  @ApiProperty() expenseLifestyle: number;
}

// ============================================================================
// 4. WRAPPER UTAMA (RESPONSE DTO)
// ============================================================================
export class EmployeeAuditDetailDto {
  @ApiProperty({ type: EmployeeProfileDto })
  profile: EmployeeProfileDto;

  @ApiProperty({ type: FinancialAnalysisDto })
  analysis: FinancialAnalysisDto;

  @ApiProperty({ type: FinancialRecordDataDto })
  record: FinancialRecordDataDto;
}