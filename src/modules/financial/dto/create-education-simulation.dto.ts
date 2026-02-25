import {
    IsString,
    IsDateString,
    IsNumber,
    IsOptional,
    IsArray,
    ValidateNested,
    Min,
    Max,
    IsEnum,
    IsNotEmpty,
    IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Pastikan Prisma Client sudah di-generate: npx prisma generate
import { SchoolLevel } from '@prisma/client';

// ==============================================================================
// LEVEL 3: RINCIAN JENJANG (STAGE) & BIAYA
// ==============================================================================
export class EducationSimulationStageItem {
    @ApiProperty({
        enum: SchoolLevel,
        example: 'SD',
        description: 'Jenjang Sekolah (TK, SD, SMP, SMA, S1, S2)',
    })
    @IsEnum(SchoolLevel)
    @IsNotEmpty()
    level: SchoolLevel;

    @ApiProperty({
        example: 6,
        description: 'Durasi sekolah dalam tahun (Default: SD=6, SMP=3, dst)',
    })
    @IsNumber()
    @Min(1)
    duration: number;

    @ApiProperty({
        example: 2028,
        description: 'Tahun masuk sekolah (Dihitung dari DoB anak di FE)',
    })
    @IsNumber()
    startYear: number;

    // --- KOMPONEN BIAYA INPUT (Current Value) ---

    @ApiProperty({
        example: 15000000,
        description: 'Uang Pangkal / Uang Gedung (Ada di semua jenjang)',
    })
    @IsNumber()
    @Min(0)
    costEntry: number;

    @ApiPropertyOptional({
        example: 1000000,
        description: 'SPP Bulanan (Khusus TK - SMA). Kosongkan jika S1/S2.',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    costMonthly?: number;

    @ApiPropertyOptional({
        example: 5000000,
        description: 'UKT per Semester (Khusus S1). Kosongkan jika jenjang lain.',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    costSemester?: number;

    @ApiPropertyOptional({
        example: 45000000,
        description: 'Biaya Paket Full Lumpsum (Khusus S2). Kosongkan jika jenjang lain.',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    costFull?: number;

    // --- HASIL KALKULASI FE (Opsional) ---
    // Backend akan menghitung ulang, tapi field ini berguna jika ingin log
    // apa yang dilihat user di layar saat tombol diklik.

    @ApiPropertyOptional({ description: 'Nilai Masa Depan (FV) snapshot dari FE' })
    @IsOptional()
    @IsNumber()
    calculatedFutureValue?: number;

    @ApiPropertyOptional({ description: 'Investasi per bulan (PMT) snapshot dari FE' })
    @IsOptional()
    @IsNumber()
    calculatedMonthlySaving?: number;
}

// ==============================================================================
// LEVEL 2: DATA ANAK
// ==============================================================================
export class EducationSimulationChildItem {
    @ApiProperty({ example: 'Budi Kecil', description: 'Nama Anak' })
    @IsString()
    @IsNotEmpty()
    childName: string;

    @ApiProperty({
        example: '2020-01-01',
        description: 'Tanggal Lahir Anak (YYYY-MM-DD)',
    })
    @IsDateString()
    @IsNotEmpty()
    childDob: string;

    @ApiProperty({
        type: [EducationSimulationStageItem],
        description: 'Daftar jenjang yang dipilih untuk anak ini',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EducationSimulationStageItem)
    stages: EducationSimulationStageItem[];
}

// ==============================================================================
// LEVEL 1: MAIN DTO (SIMULASI PENDIDIKAN AGEN)
// ==============================================================================
export class CreateEducationSimulationDto {
    // ===========================================================================
    // LEVEL 0: SYSTEM METADATA (Security & Idempotency)
    // ===========================================================================

    @ApiProperty({
        description: 'ID Unik Sesi Simulasi (UUID v4). Digunakan untuk membedakan revisi (gratis) vs sesi baru (bayar).',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsNotEmpty({ message: 'Session ID wajib disertakan.' })
    @IsUUID('4', { message: 'Session ID harus berupa UUID v4 yang valid.' })
    sessionId: string;

    // --- 1. IDENTITAS KLIEN ---

    @ApiProperty({ example: 'Bapak Budi', description: 'Nama Lengkap Klien' })
    @IsString()
    @IsNotEmpty()
    clientName: string;

    @ApiPropertyOptional({ example: '1985-05-20', description: 'Tanggal Lahir Klien' })
    @IsOptional()
    @IsDateString()
    clientDob?: string;

    @ApiProperty({ example: 'Jakarta Selatan', description: 'Domisili Klien' })
    @IsString()
    @IsNotEmpty()
    clientCity: string;

    @ApiPropertyOptional({ example: 'Wiraswasta', description: 'Pekerjaan Klien' })
    @IsOptional()
    @IsString()
    clientJob?: string;

    @ApiPropertyOptional({ example: '08123456789', description: 'No HP (Tampil di footer laporan)' })
    @IsOptional()
    @IsString()
    clientPhone?: string;

    // --- 2. ASUMSI FINANSIAL ---

    @ApiPropertyOptional({
        example: 10,
        description: 'Asumsi Inflasi Pendidikan Tahunan (%)',
        default: 10,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    inflationRate: number = 10;

    @ApiPropertyOptional({
        example: 12,
        description: 'Asumsi Return Investasi Tahunan (%)',
        default: 12,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    returnRate: number = 12;

    // --- 3. PAYLOAD RENCANA ---

    @ApiProperty({
        type: [EducationSimulationChildItem],
        description: 'List anak dan rencana sekolah mereka',
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EducationSimulationChildItem)
    childrenPlans: EducationSimulationChildItem[];
}