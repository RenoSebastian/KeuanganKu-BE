import { 
  IsString, 
  IsNumber, 
  IsDateString, 
  IsOptional, 
  IsEnum, 
  ValidateNested, 
  IsArray, 
  Min, 
  Max 
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolLevel, CostType, EducationMethod } from '@prisma/client';

// --- SUB-DTO: TAHAPAN SEKOLAH (Child Object) ---
export class CreateEducationStageDto {
  @ApiProperty({ enum: SchoolLevel, example: 'TK', description: 'Jenjang sekolah (TK/SD/SMP/SMA/PT)' })
  @IsEnum(SchoolLevel, { message: 'Jenjang sekolah tidak valid (TK, SD, SMP, SMA, PT)' })
  level: SchoolLevel;

  @ApiProperty({ enum: CostType, example: 'ENTRY', description: 'Tipe biaya: Uang Pangkal (ENTRY) atau SPP (ANNUAL)' })
  @IsEnum(CostType, { message: 'Tipe biaya tidak valid (ENTRY/ANNUAL)' })
  costType: CostType;

  @ApiProperty({ example: 15000000, description: 'Biaya saat ini (Present Value). Boleh 0 untuk skema khusus (misal S2 tanpa SPP).' })
  @IsNumber()
  @Min(0, { message: 'Biaya tidak boleh negatif' }) // CRITICAL: Mengizinkan 0 agar S2 bisa tanpa biaya bulanan
  @Type(() => Number)
  currentCost: number;

  @ApiProperty({ example: 2, description: 'Jarak waktu (tahun) menuju pembayaran biaya ini' })
  @IsNumber()
  @Min(0, { message: 'Tahun mulai tidak boleh negatif' })
  @Type(() => Number)
  yearsToStart: number; 
  
  // Catatan: futureCost (FV) dan monthlySaving (PMT) akan dihitung otomatis di Backend Logic.
}

// --- MAIN DTO: RENCANA PENDIDIKAN (Parent Object) ---
export class CreateEducationPlanDto {
  // 1. DATA ANAK
  @ApiProperty({ example: 'Budi Kecil', description: 'Nama Anak' })
  @IsString()
  childName: string;

  @ApiProperty({ example: '2020-01-01', description: 'Tanggal Lahir Anak (YYYY-MM-DD)' })
  @IsDateString()
  childDob: string;

  // 2. METODE & ASUMSI
  @ApiPropertyOptional({ enum: EducationMethod, default: 'GEOMETRIC' })
  @IsEnum(EducationMethod)
  @IsOptional()
  method?: EducationMethod = EducationMethod.GEOMETRIC;

  @ApiPropertyOptional({ example: 10, description: 'Asumsi Inflasi Pendidikan (%)', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  inflationRate?: number = 10; // Default inflasi tinggi untuk pendidikan

  @ApiPropertyOptional({ example: 12, description: 'Target Return Investasi (%)', default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  returnRate?: number = 12;

  // 3. DETAIL TAHAPAN (ARRAY)
  @ApiProperty({ type: [CreateEducationStageDto], description: 'Daftar rincian biaya pendidikan' })
  @IsArray()
  @ValidateNested({ each: true }) // Validasi deep untuk setiap item dalam array
  @Type(() => CreateEducationStageDto) // Transformasi JSON ke Class Instance
  stages: CreateEducationStageDto[];
}