import { ApiProperty } from '@nestjs/swagger';
import { HealthStatus } from '@prisma/client';

// --------------------------------------------------------
// 1. DTO untuk Ranking Unit Kerja (Divisi)
// --------------------------------------------------------
export class UnitRankingDto {
  @ApiProperty({ example: 'uuid-unit-001', description: 'ID Unit Kerja' })
  id: string;

  @ApiProperty({ example: 'Divisi Teknologi Informasi', description: 'Nama Unit Kerja' })
  unitName: string;

  @ApiProperty({ example: 45, description: 'Jumlah karyawan dalam unit ini' })
  employeeCount: number;

  @ApiProperty({ example: 85, description: 'Rata-rata Health Score unit ini' })
  avgScore: number;

  @ApiProperty({ 
    enum: HealthStatus, 
    example: 'SEHAT', 
    description: 'Status agregat kesehatan unit' 
  })
  status: HealthStatus;
}

// --------------------------------------------------------
// 2. DTO untuk List Karyawan Berisiko (Risk Monitor)
// --------------------------------------------------------
export class RiskyEmployeeDto {
  @ApiProperty({ example: 'uuid-user-123', description: 'ID User Karyawan' })
  id: string;

  @ApiProperty({ example: 'Budi Santoso', description: 'Nama Lengkap Karyawan' })
  fullName: string;

  @ApiProperty({ example: 'Divisi Operasional', description: 'Unit Kerja Karyawan' })
  unitName: string;

  @ApiProperty({ 
    enum: HealthStatus, 
    example: 'BAHAYA', 
    description: 'Status kesehatan finansial saat ini' 
  })
  status: HealthStatus;

  @ApiProperty({ example: 45, description: 'Skor kesehatan finansial (0-100)' })
  healthScore: number;

  @ApiProperty({ 
    example: 65.5, 
    description: 'Rasio hutang terhadap pendapatan (%) - Optional', 
    required: false 
  })
  debtToIncomeRatio?: number; 

  @ApiProperty({ example: '2024-04-20T00:00:00.000Z', description: 'Tanggal checkup terakhir' })
  lastCheckDate: Date;
}

// --------------------------------------------------------
// 3. DTO untuk Statistik Sebaran Status (Pie Chart Data)
// --------------------------------------------------------
export class StatusCountDto {
  @ApiProperty({ example: 120, description: 'Jumlah karyawan Sehat' })
  SEHAT: number;

  @ApiProperty({ example: 45, description: 'Jumlah karyawan Waspada' })
  WASPADA: number;

  @ApiProperty({ example: 12, description: 'Jumlah karyawan Bahaya' })
  BAHAYA: number;
}

// --------------------------------------------------------
// 4. DTO Utama: Dashboard Resume (Output /director/dashboard-stats)
// --------------------------------------------------------
export class DashboardStatsDto {
  @ApiProperty({ example: 1450, description: 'Total seluruh karyawan terdaftar' })
  totalEmployees: number;

  @ApiProperty({ example: 72, description: 'Rata-rata skor kesehatan seluruh perusahaan' })
  avgHealthScore: number;

  @ApiProperty({ example: 12, description: 'Jumlah karyawan yang berstatus BAHAYA' })
  riskyEmployeesCount: number;

  @ApiProperty({ example: 45000000000, description: 'Total estimasi aset bersih seluruh karyawan (Rupiah)' })
  totalAssetsManaged: number;

  @ApiProperty({ type: StatusCountDto, description: 'Detail jumlah karyawan per status' })
  statusCounts: StatusCountDto;
}

// ========================================================
// NEW: DTO UNTUK AUDIT DETAIL KARYAWAN
// ========================================================

// --------------------------------------------------------
// 5. Bagian Profile Header
// --------------------------------------------------------
export class AuditProfileDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Ahmad Junaedi' })
  fullName: string;

  @ApiProperty({ example: 'Divisi Umum' })
  unitName: string;

  @ApiProperty({ example: 'ahmad@pamjaya.co.id' })
  email: string;

  @ApiProperty({ enum: HealthStatus, example: 'BAHAYA' })
  status: HealthStatus;

  @ApiProperty({ example: 40 })
  healthScore: number;

  @ApiProperty()
  lastCheckDate: Date;
}

// --------------------------------------------------------
// 6. Bagian Demografi (Nested di dalam Record)
// --------------------------------------------------------
export class AuditDemographicDto {
  @ApiProperty({ example: 'Ahmad Junaedi' })
  name: string;
  
  // Field lain opsional karena diambil dari User table yang mungkin kosong
  @ApiProperty({ required: false }) dob?: string;
  @ApiProperty({ required: false }) gender?: string;
  @ApiProperty({ required: false }) occupation?: string;
}

// --------------------------------------------------------
// 7. Bagian Financial Record (Mapping Eksplisit 40+ Variabel)
// --------------------------------------------------------
export class FinancialRecordDto {
  @ApiProperty({ type: AuditDemographicDto })
  userProfile: AuditDemographicDto;

  // --- A. Aset Likuid ---
  @ApiProperty() assetCash: number;

  // --- B. Aset Personal ---
  @ApiProperty() assetHome: number;
  @ApiProperty() assetVehicle: number;
  @ApiProperty() assetJewelry: number;
  @ApiProperty() assetAntique: number;
  @ApiProperty() assetPersonalOther: number;

  // --- C. Aset Investasi ---
  @ApiProperty() assetInvHome: number;
  @ApiProperty() assetInvVehicle: number;
  @ApiProperty() assetGold: number;
  @ApiProperty() assetInvAntique: number;
  @ApiProperty() assetStocks: number;
  @ApiProperty() assetMutualFund: number;
  @ApiProperty() assetBonds: number;
  @ApiProperty() assetDeposit: number;
  @ApiProperty() assetInvOther: number;

  // --- E. Utang Konsumtif ---
  @ApiProperty() debtKPR: number;
  @ApiProperty() debtKPM: number;
  @ApiProperty() debtCC: number;
  @ApiProperty() debtCoop: number;
  @ApiProperty() debtConsumptiveOther: number;

  // --- F. Utang Usaha ---
  @ApiProperty() debtBusiness: number;

  // --- I. Penghasilan ---
  @ApiProperty() incomeFixed: number;
  @ApiProperty() incomeVariable: number;

  // --- K. Cicilan Utang ---
  @ApiProperty() installmentKPR: number;
  @ApiProperty() installmentKPM: number;
  @ApiProperty() installmentCC: number;
  @ApiProperty() installmentCoop: number;
  @ApiProperty() installmentConsumptiveOther: number;
  @ApiProperty() installmentBusiness: number;

  // --- L. Premi Asuransi ---
  @ApiProperty() insuranceLife: number;
  @ApiProperty() insuranceHealth: number;
  @ApiProperty() insuranceHome: number;
  @ApiProperty() insuranceVehicle: number;
  @ApiProperty() insuranceBPJS: number;
  @ApiProperty() insuranceOther: number;

  // --- M. Tabungan ---
  @ApiProperty() savingEducation: number;
  @ApiProperty() savingRetirement: number;
  @ApiProperty() savingPilgrimage: number;
  @ApiProperty() savingHoliday: number;
  @ApiProperty() savingEmergency: number;
  @ApiProperty() savingOther: number;

  // --- N. Pengeluaran ---
  @ApiProperty() expenseFood: number;
  @ApiProperty() expenseSchool: number;
  @ApiProperty() expenseTransport: number;
  @ApiProperty() expenseCommunication: number;
  @ApiProperty() expenseHelpers: number;
  @ApiProperty() expenseTax: number;
  @ApiProperty() expenseLifestyle: number;
}

// --------------------------------------------------------
// 8. Bagian Hasil Analisa
// --------------------------------------------------------
export class AnalysisResultDto {
  @ApiProperty({ example: 45 })
  score: number;

  @ApiProperty({ example: 'BAHAYA' })
  globalStatus: string;

  @ApiProperty({ example: 250000000, description: 'Kekayaan Bersih' })
  netWorth: number;

  @ApiProperty({ example: 1500000, description: 'Surplus/Defisit Bulanan' })
  surplusDeficit: number;

  @ApiProperty()
  generatedAt: Date;
}

// --------------------------------------------------------
// 9. Wrapper DTO Utama (Response Endpoint)
// --------------------------------------------------------
export class EmployeeAuditDetailDto {
  @ApiProperty({ type: AuditProfileDto })
  profile: AuditProfileDto;

  @ApiProperty({ type: FinancialRecordDto })
  record: FinancialRecordDto;

  @ApiProperty({ type: AnalysisResultDto })
  analysis: AnalysisResultDto;
}