import { IsString, IsNumber, IsDateString, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================================================
// 1. DTO UNTUK MENYIMPAN GOAL (PERSISTENCE)
// Digunakan saat user klik "Simpan Tujuan"
// ============================================================================
export class CreateGoalDto {
  @ApiProperty({ example: 'Liburan ke Jepang', description: 'Nama tujuan keuangan' })
  @IsString()
  @IsNotEmpty({ message: 'Nama tujuan keuangan tidak boleh kosong' })
  goalName: string;

  @ApiProperty({ example: 100000000, description: 'Target dana akhir yang ingin dicapai' })
  @IsNumber()
  @Min(0, { message: 'Target dana tidak boleh negatif' })
  @Type(() => Number)
  targetAmount: number;

  @ApiProperty({ example: '2030-12-31', description: 'Tanggal target tercapai (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'Format tanggal harus valid (YYYY-MM-DD)' })
  targetDate: string;

  @ApiPropertyOptional({ example: 5, description: 'Asumsi inflasi tahunan (%)', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  inflationRate?: number = 5;

  @ApiPropertyOptional({ example: 6, description: 'Asumsi return investasi tahunan (%)', default: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  returnRate?: number = 6;
}

// ============================================================================
// 2. DTO UNTUK SIMULASI GOAL (CALCULATOR)
// Digunakan untuk endpoint: /financial/goals/simulate
// ============================================================================
export class SimulateGoalDto {
  @ApiProperty({ example: 50000000, description: 'Harga barang/jasa saat ini (Present Value)' })
  @IsNumber()
  @Min(0, { message: 'Biaya saat ini tidak boleh negatif' })
  @Type(() => Number)
  currentCost: number; // PV

  @ApiProperty({ example: 5, description: 'Jangka waktu dalam tahun' })
  @IsNumber()
  @Min(1, { message: 'Durasi minimal 1 tahun' })
  @Type(() => Number)
  years: number; // n

  @ApiPropertyOptional({ example: 5, description: 'Asumsi inflasi tahunan (%)', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  inflationRate?: number = 5; // i

  @ApiPropertyOptional({ example: 6, description: 'Asumsi return investasi tahunan (%)', default: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  returnRate?: number = 6; // r
}