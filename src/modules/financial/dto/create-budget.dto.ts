import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 1, description: 'Bulan (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  @IsNotEmpty()
  month: number;

  @ApiProperty({ example: 2025 })
  @IsNumber()
  @IsNotEmpty()
  year: number;

  // --- PEMASUKAN ---
  @ApiProperty({ example: 8400000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  fixedIncome: number; // Gaji Tetap (Basis Rule)

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  variableIncome: number; // Bonus/Tunjangan

  // --- 5 POS PENGELUARAN (SEKARANG OPSIONAL) ---
  // Sistem akan menghitung otomatis di Service jika field di bawah ini kosong.

  @ApiPropertyOptional({ example: 1000000, description: 'Max 20% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  productiveDebt?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Max 15% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  consumptiveDebt?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Min 10% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  insurance?: number;

  @ApiPropertyOptional({ example: 1000000, description: 'Min 10% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  saving?: number;

  @ApiPropertyOptional({ example: 3000000, description: 'Max 45% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  livingCost?: number;
}