import { IsNumber, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePensionDto {
  // 1. DATA PRIBADI (USIA)
  @IsInt({ message: 'Usia saat ini harus berupa angka bulat' })
  @Min(15, { message: 'Usia minimal 15 tahun' })
  @Max(70, { message: 'Usia maksimal 70 tahun' })
  @Type(() => Number)
  currentAge: number;

  @IsInt({ message: 'Usia pensiun harus berupa angka bulat' })
  @Min(40, { message: 'Usia pensiun minimal 40 tahun' })
  @Max(100, { message: 'Usia pensiun maksimal 100 tahun' })
  @Type(() => Number)
  retirementAge: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Type(() => Number)
  lifeExpectancy?: number = 80; // Default umur harapan hidup

  // 2. KONDISI KEUANGAN SAAT INI
  @IsNumber()
  @Min(0, { message: 'Biaya hidup tidak boleh negatif' })
  @Type(() => Number)
  currentExpense: number; // Biaya hidup per bulan saat ini

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentSaving?: number = 0; // Aset/Tabungan pensiun yang sudah ada

  // 3. ASUMSI MAKRO (INFLASI & RETURN)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50) // Inflasi gak mungkin > 50% (kecuali krisis)
  @Type(() => Number)
  inflationRate?: number = 5; // Default 5%

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  returnRate?: number = 8; // Default Return Investasi 8%
}