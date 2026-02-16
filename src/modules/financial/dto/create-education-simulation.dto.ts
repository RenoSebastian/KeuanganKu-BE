import {
    IsString,
    IsDateString,
    IsNumber,
    IsOptional,
    IsArray,
    ValidateNested,
    Min,
    Max,
    IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEducationStageDto, EducationMethod } from './create-education.dto';

// --- SUB-DTO: ITEM ANAK (Mirip CreateEducationPlanDto tapi sebagai Item Array) ---
export class EducationSimulationChildItem {
    @ApiProperty({ example: 'Budi Kecil', description: 'Nama Anak' })
    @IsString()
    childName: string;

    @ApiProperty({ example: '2020-01-01', description: 'Tanggal Lahir Anak (YYYY-MM-DD)' })
    @IsDateString()
    childDob: string;

    // --- Opsi Ekonomi per Anak (Bisa dicustom per anak jika perlu) ---
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
    inflationRate?: number = 10;

    @ApiPropertyOptional({ example: 12, description: 'Target Return Investasi (%)', default: 12 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(50)
    @Type(() => Number)
    returnRate?: number = 12;

    // --- REUSE VALIDASI JENJANG SEKOLAH (TK, SD, SMP, dst) ---
    @ApiProperty({ type: [CreateEducationStageDto], description: 'Daftar rincian biaya sekolah anak ini' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEducationStageDto)
    stages: CreateEducationStageDto[];
}

// --- MAIN DTO: SIMULASI PENDIDIKAN AGEN (Parent Object) ---
export class CreateEducationSimulationDto {
    // 1. DATA IDENTITAS KLIEN (Untuk Laporan & Log)
    @ApiProperty({ example: 'Bapak Budi', description: 'Nama Lengkap Klien' })
    @IsString()
    clientName: string;

    @ApiProperty({ example: '1985-05-20', description: 'Tanggal Lahir Klien' })
    @IsDateString()
    clientDob: string;

    @ApiProperty({ example: 'Jakarta Selatan', description: 'Domisili Klien' })
    @IsString()
    clientCity: string;

    @ApiPropertyOptional({ example: 'Wiraswasta', description: 'Pekerjaan Klien' })
    @IsOptional()
    @IsString()
    clientJob: string;

    @ApiPropertyOptional({ example: '08123456789', description: 'Nomor HP Klien (Opsional untuk footer laporan)' })
    @IsOptional()
    @IsString()
    clientPhone: string;

    // 2. KONTEKS FINANSIAL KLIEN (Opsional)
    @ApiPropertyOptional({
        example: 50000000,
        description: 'Tabungan pendidikan yang sudah dimiliki saat ini (Existing Fund)',
        default: 0
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    currentSaving?: number = 0;

    // 3. DATA RENCANA PENDIDIKAN (Array of Children)
    @ApiProperty({
        type: [EducationSimulationChildItem],
        description: 'List rencana pendidikan untuk setiap anak'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EducationSimulationChildItem)
    childrenPlans: EducationSimulationChildItem[];
}