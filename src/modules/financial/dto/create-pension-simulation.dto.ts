import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsNumber,
    Min,
    Max,
    IsOptional,
    IsDateString
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO: CreatePensionSimulationDto
 * -------------------------------------------------------------------------
 * Data Transfer Object untuk menangani input simulasi Dana Pensiun (Stateless).
 * * Design Pattern:
 * Menggunakan pendekatan Flat-DTO untuk kemudahan parsing dari Frontend,
 * namun secara logis data terbagi menjadi dua segmen:
 * 1. Identity Segment: Metadata untuk header laporan PDF.
 * 2. Financial Segment: Parameter inti untuk kalkulasi TVM (Time Value of Money).
 * * Validasi:
 * - Menggunakan 'class-validator' untuk memastikan integritas tipe data.
 * - Validasi logika bisnis (seperti retirementAge > currentAge) akan
 * diesekusi di Service Layer untuk error handling yang lebih kontekstual.
 */
export class CreatePensionSimulationDto {

    // =======================================================================
    // SEGMENT 1: CLIENT IDENTITY (Metadata Laporan)
    // =======================================================================

    @ApiProperty({
        description: 'Nama lengkap klien untuk dicetak pada header laporan',
        example: 'Budi Santoso',
    })
    @IsNotEmpty({ message: 'Nama klien wajib diisi' })
    @IsString()
    clientName: string;

    @ApiProperty({
        description: 'Tanggal lahir klien (ISO 8601). Digunakan untuk validasi usia.',
        example: '1985-05-20',
    })
    @IsNotEmpty({ message: 'Tanggal lahir wajib diisi' })
    @IsDateString()
    clientDob: string;

    @ApiProperty({
        description: 'Kota domisili klien',
        example: 'Jakarta Selatan',
    })
    @IsNotEmpty({ message: 'Kota domisili wajib diisi' })
    @IsString()
    clientCity: string;

    @ApiPropertyOptional({
        description: 'Pekerjaan klien saat ini (Opsional)',
        example: 'Manager Pemasaran',
    })
    @IsOptional()
    @IsString()
    clientJob?: string;

    @ApiPropertyOptional({
        description: 'Nomor HP klien untuk referensi kontak (Opsional)',
        example: '081234567890',
    })
    @IsOptional()
    @IsString()
    clientPhone?: string;

    // =======================================================================
    // SEGMENT 2: CALCULATION PARAMETERS (Time Horizon & Financials)
    // =======================================================================

    @ApiProperty({
        description: 'Usia klien saat ini (Tahun)',
        example: 40,
        minimum: 1,
        maximum: 100,
    })
    @IsNotEmpty({ message: 'Usia saat ini wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(90, { message: 'Usia saat ini tidak boleh melebihi 90 tahun untuk simulasi ini' })
    currentAge: number;

    @ApiProperty({
        description: 'Target usia pensiun yang diinginkan (Tahun)',
        example: 55,
        minimum: 1,
        maximum: 100,
    })
    @IsNotEmpty({ message: 'Target usia pensiun wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    retirementAge: number;

    @ApiProperty({
        description: 'Asumsi usia harapan hidup (Life Expectancy) dalam Tahun. Default: 80',
        example: 80,
        default: 80,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(50)
    @Max(120)
    lifeExpectancy?: number = 80;

    @ApiProperty({
        description: 'Pengeluaran/Biaya hidup bulanan saat ini (Rp). Basis perhitungan gaya hidup.',
        example: 5000000,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Pengeluaran bulanan saat ini wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    currentExpense: number;

    @ApiPropertyOptional({
        description: 'Aset/Tabungan pensiun yang sudah terkumpul saat ini (Rp). Default: 0',
        example: 100000000,
        default: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    currentSaving?: number = 0;

    // =======================================================================
    // SEGMENT 3: ECONOMIC ASSUMPTIONS (Global Parameters)
    // =======================================================================

    @ApiPropertyOptional({
        description: 'Asumsi tingkat inflasi tahunan (%). Default: 5%',
        example: 5.5,
        default: 5,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(50, { message: 'Rate inflasi tidak realistis (>50%)' })
    inflationRate?: number = 5;

    @ApiPropertyOptional({
        description: 'Estimasi return investasi tahunan (%). Default: 8%',
        example: 8,
        default: 8,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100, { message: 'Return investasi tidak realistis (>100%)' })
    returnRate?: number = 8;
}