import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';

// Enum Manual (Agar tidak error jika Prisma belum generate)
export enum InsuranceType {
  LIFE = 'LIFE',
  HEALTH = 'HEALTH',
  CRITICAL_ILLNESS = 'CRITICAL_ILLNESS'
}

export class CreateInsuranceDto {
  // ===========================================================================
  // 1. TIPE & PROFIL DASAR
  // ===========================================================================

  @ApiProperty({ enum: InsuranceType, description: 'Jenis Asuransi' })
  @IsEnum(InsuranceType, { message: 'Tipe asuransi tidak valid' })
  type: InsuranceType;

  @ApiProperty({ description: 'Jumlah orang yang ditanggung', example: 2 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  dependentCount: number;

  // ===========================================================================
  // 2. VARIABEL KEUANGAN (LIABILITIES & NEEDS)
  // Sesuai dengan Logic di InsuranceService.ts
  // ===========================================================================

  /** * Sisa Hutang Berjalan (Outstanding Debt)
   * Service Property: sisaHutang 
   */
  @ApiPropertyOptional({ description: 'Sisa hutang berjalan (KPR/KPM/CC)', example: 500000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sisaHutang?: number = 0; // Alias: existingDebt

  /**
   * Biaya Pemakaman / Duka (Final Expenses)
   * Service Property: biayaPemakaman
   */
  @ApiPropertyOptional({ description: 'Estimasi biaya pemakaman/duka', example: 50000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  biayaPemakaman?: number = 0;

  /**
   * Estimasi Pajak Waris / Balik Nama (Estate Tax)
   * Service Property: estimasiPajak
   */
  @ApiPropertyOptional({ description: 'Estimasi pajak waris/balik nama aset', example: 25000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimasiPajak?: number = 0;

  /**
   * Dana Pendidikan Anak (Lumpsum)
   * Service Property: biayaPendidikan
   */
  @ApiPropertyOptional({ description: 'Dana pendidikan yang harus disiapkan (Total)', example: 1000000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  biayaPendidikan?: number = 0;

  // ===========================================================================
  // 3. INCOME REPLACEMENT VARIABLES
  // ===========================================================================

  /**
   * Biaya Hidup Keluarga yang Ditinggalkan (Per Bulan)
   * Service Property: biayaHidupSurvivor
   */
  @ApiProperty({ description: 'Biaya hidup bulanan keluarga survivor', example: 10000000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  biayaHidupSurvivor: number; // Alias: monthlyExpense

  /**
   * Durasi Proteksi (Tahun)
   * Service Property: proteksiTahun
   */
  @ApiPropertyOptional({ description: 'Berapa tahun dana harus bertahan', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  proteksiTahun?: number = 10;

  // ===========================================================================
  // 4. EXISTING RESOURCES (PENGURANG KEBUTUHAN)
  // ===========================================================================

  /**
   * Aset Likuid (Deposito, Emas, Tabungan)
   * Service Property: asetLikuid
   */
  @ApiPropertyOptional({ description: 'Total aset likuid yang sudah ada', example: 100000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  asetLikuid?: number = 0;

  /**
   * Uang Pertanggungan (UP) Polis Lama
   * Service Property: asuransiExisting
   */
  @ApiPropertyOptional({ description: 'UP Asuransi yang sudah dimiliki', example: 200000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  asuransiExisting?: number = 0; // Alias: existingCoverage

  // ===========================================================================
  // 5. ASUMSI EKONOMI
  // ===========================================================================

  @ApiPropertyOptional({ description: 'Tingkat Inflasi Tahunan (%)', example: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  inflasiRate?: number = 5;

  @ApiPropertyOptional({ description: 'Tingkat Return Investasi (%)', example: 6 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  investasiRate?: number = 6; // Alias: returnRate
}