import { IsString, IsNumber, IsDateString, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoalDto {
  // 1. IDENTITAS GOAL
  @IsString()
  @IsNotEmpty({ message: 'Nama tujuan keuangan tidak boleh kosong' })
  goalName: string; // Contoh: "Liburan ke Jepang", "DP Rumah"

  // 2. TARGET DANA
  @IsNumber()
  @Min(0, { message: 'Target dana tidak boleh negatif' })
  @Type(() => Number)
  targetAmount: number; // Berapa uang yang dibutuhkan (Nilai Sekarang/PV)

  // 3. TARGET WAKTU
  @IsDateString({}, { message: 'Format tanggal harus valid (YYYY-MM-DD)' })
  targetDate: string; // Kapan tujuan ini harus tercapai

  // 4. ASUMSI
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  inflationRate?: number = 5; // Default inflasi barang terkait (misal properti beda dgn gadget)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  returnRate?: number = 6; // Instrumen investasi apa yang dipakai?
}