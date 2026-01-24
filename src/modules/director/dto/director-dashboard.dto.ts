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
    description: 'Status agregat kesehatan unit (Dihitung berdasarkan Avg Score)' 
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

  @ApiProperty({ example: '2026-01-24T00:00:00.000Z', description: 'Tanggal checkup terakhir' })
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
// PHASE 5 ADDITIONS: COMPOSITE WRAPPER
// ========================================================

// --------------------------------------------------------
// 5. Metadata DTO (Timestamp)
// --------------------------------------------------------
export class DashboardMetaDto {
  @ApiProperty({ example: '2026-01-24T10:00:00Z', description: 'Waktu server saat data digenerate' })
  generatedAt: Date;
}

// --------------------------------------------------------
// 6. COMPOSITE DTO: Dashboard Summary (Orchestrator Payload)
// --------------------------------------------------------
export class DashboardSummaryDto {
  @ApiProperty({ type: DashboardStatsDto, description: 'Statistik Global' })
  stats: DashboardStatsDto;

  @ApiProperty({ type: [RiskyEmployeeDto], description: 'Top 5 karyawan berisiko (Preview)' })
  topRiskyEmployees: RiskyEmployeeDto[];

  @ApiProperty({ type: [UnitRankingDto], description: 'Top 5 unit dengan score terendah (Preview)' })
  unitRankings: UnitRankingDto[];

  @ApiProperty({ type: DashboardMetaDto, description: 'Metadata response' })
  meta: DashboardMetaDto;
}

// NOTE: 
// DTO untuk 'EmployeeAuditDetailDto' berada di file terpisah:
// src/modules/director/dto/employee-detail-response.dto.ts