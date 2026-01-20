import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 1, description: 'Bulan (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2025 })
  @IsNumber()
  year: number;

  // --- PEMASUKAN ---
  @ApiProperty({ example: 8400000 })
  @IsNumber()
  @Min(0)
  fixedIncome: number; // Gaji Tetap (Basis Rule)

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  @Min(0)
  variableIncome: number; // Bonus/Tunjangan

  // --- 5 POS PENGELUARAN ---
  @ApiProperty({ example: 1000000, description: 'Max 20% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  productiveDebt: number;

  @ApiProperty({ example: 500000, description: 'Max 15% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  consumptiveDebt: number;

  @ApiProperty({ example: 500000, description: 'Min 10% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  insurance: number;

  @ApiProperty({ example: 1000000, description: 'Min 10% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  saving: number;

  @ApiProperty({ example: 3000000, description: 'Max 45% Gaji Tetap' })
  @IsNumber()
  @Min(0)
  livingCost: number;
}