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
import { SchoolLevel, CostType, EducationMethod } from '@prisma/client';

// --- SUB-DTO: TAHAPAN SEKOLAH (Child Object) ---
export class CreateEducationStageDto {
  @IsEnum(SchoolLevel, { message: 'Jenjang sekolah tidak valid (TK, SD, SMP, SMA, PT)' })
  level: SchoolLevel;

  @IsEnum(CostType, { message: 'Tipe biaya tidak valid (ENTRY/ANNUAL)' })
  costType: CostType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentCost: number; // Biaya saat ini (PV)

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  yearsToStart: number; // Berapa tahun lagi anak masuk ke jenjang ini? (n)
  
  // Catatan: futureCost (FV) dan monthlySaving (PMT) tidak dikirim dari FE, 
  // tapi dihitung oleh BE. Jadi tidak perlu ada di DTO ini.
}

// --- MAIN DTO: RENCANA PENDIDIKAN (Parent Object) ---
export class CreateEducationPlanDto {
  // 1. DATA ANAK
  @IsString()
  childName: string;

  @IsDateString()
  childDob: string; // Tanggal lahir anak (untuk validasi umur)

  // 2. METODE & ASUMSI
  @IsEnum(EducationMethod)
  @IsOptional()
  method?: EducationMethod = EducationMethod.GEOMETRIC; // Default Inflasi Bertahap

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  inflationRate?: number = 10; // Inflasi pendidikan biasanya tinggi (10-15%)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  @Type(() => Number)
  returnRate?: number = 12; // Asumsi return investasi (saham/reksadana)

  // 3. DETAIL TAHAPAN (ARRAY)
  @IsArray()
  @ValidateNested({ each: true }) // Validasi setiap item di dalam array
  @Type(() => CreateEducationStageDto) // Transformasi JSON ke Class Instance
  stages: CreateEducationStageDto[];
}