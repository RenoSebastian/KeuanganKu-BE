import { IsNumber, IsInt, Min, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { InsuranceType } from '@prisma/client'; // Pastikan prisma client sudah digenerate

export class CreateInsuranceDto {
  // 1. TIPE ASURANSI
  @IsEnum(InsuranceType, { message: 'Tipe asuransi tidak valid (LIFE, HEALTH, CRITICAL_ILLNESS)' })
  type: InsuranceType;

  // 2. DATA TANGGUNGAN
  @IsInt()
  @Min(0)
  @Type(() => Number)
  dependentCount: number; // Jumlah orang yang ditanggung (Istri/Anak)

  // 3. KONDISI KEUANGAN
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monthlyExpense: number; // Pengeluaran rutin keluarga per bulan

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  existingDebt?: number = 0; // Sisa hutang berjalan (agar tercover jika terjadi risiko)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  existingCoverage?: number = 0; // Uang Pertanggungan yang sudah dimiliki sekarang

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  protectionDuration?: number = 10; // Berapa tahun ingin diproteksi (Default 10 tahun)

  // --- [FIX] PARAMETER TAMBAHAN AGAR SLIDER BERFUNGSI ---
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  inflationRate?: number = 5; // Default 5% jika tidak dikirim Frontend

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  returnRate?: number = 7; // Default 7% jika tidak dikirim Frontend
}