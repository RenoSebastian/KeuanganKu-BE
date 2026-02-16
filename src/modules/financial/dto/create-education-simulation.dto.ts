import {
    IsString,
    IsDateString,
    IsNumber,
    IsOptional,
    IsArray,
    ValidateNested,
    Min,
    Max
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEducationStageDto } from './create-education.dto';

// --- SUB-DTO: ITEM ANAK ---
export class EducationSimulationChildItem {
    @ApiProperty({ example: 'Budi Kecil', description: 'Nama Anak' })
    @IsString()
    childName: string;

    @ApiProperty({ example: '2020-01-01', description: 'Tanggal Lahir Anak (YYYY-MM-DD)' })
    @IsDateString()
    childDob: string;

    // [DELETED] method: EducationMethod; 
    // Alasan: Metode perhitungan dikunci ke "Flat/Annuity" di Backend (Service Layer).

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

    // [DELETED] currentSaving 
    // Alasan: Perhitungan PAM Jaya tidak memperhitungkan tabungan saat ini (Pure Future Value Annuity).

    // 2. DATA RENCANA PENDIDIKAN (Array of Children)
    @ApiProperty({
        type: [EducationSimulationChildItem],
        description: 'List rencana pendidikan untuk setiap anak'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EducationSimulationChildItem)
    childrenPlans: EducationSimulationChildItem[];
}