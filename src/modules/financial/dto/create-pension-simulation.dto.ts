import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsNumber,
    Min,
    Max,
    IsOptional,
    IsDateString,
    IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO: CreatePensionSimulationDto
 * -------------------------------------------------------------------------
 * Data Transfer Object untuk menangani input simulasi Dana Pensiun (Stateless).
 * * Logic Note:
 * Variabel 'currentSaving' akan diproses di Service menggunakan rate konstan 5.5%
 * untuk menghasilkan 'fvExistingFund' yang akan ditampilkan di FE & PDF.
 */
export class CreatePensionSimulationDto {
    // ===========================================================================
    // SEGMENT 0: SYSTEM METADATA (Security & Idempotency)
    // ===========================================================================

    @ApiProperty({
        description: 'ID Unik Sesi Simulasi (UUID v4). Digunakan untuk tracking kuota dan revisi.',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsNotEmpty({ message: 'Session ID wajib disertakan.' })
    @IsUUID('4', { message: 'Session ID harus berupa UUID v4 yang valid.' })
    sessionId: string;

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
        description: 'Tanggal lahir klien (ISO 8601).',
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
    })
    @IsNotEmpty({ message: 'Usia saat ini wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(90)
    currentAge: number;

    @ApiProperty({
        description: 'Target usia pensiun yang diinginkan (Tahun)',
        example: 55,
        minimum: 1,
    })
    @IsNotEmpty({ message: 'Target usia pensiun wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    retirementAge: number;

    @ApiProperty({
        description: 'Asumsi usia harapan hidup (Life Expectancy). Default: 85',
        example: 85,
        default: 85,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(50)
    @Max(120)
    lifeExpectancy?: number = 85;

    @ApiProperty({
        description: 'Pengeluaran bulanan saat ini (Rp).',
        example: 5000000,
    })
    @IsNotEmpty({ message: 'Pengeluaran bulanan saat ini wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    currentExpense: number;

    @ApiPropertyOptional({
        description: 'Aset pensiun (JHT/DPLK/Tabungan) yang sudah ada saat ini (Rp).',
        example: 100000000,
        default: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    currentSaving?: number = 0;

    // =======================================================================
    // SEGMENT 3: ECONOMIC ASSUMPTIONS
    // =======================================================================

    @ApiPropertyOptional({
        description: 'Asumsi tingkat inflasi tahunan (%). Default: 5%',
        example: 5,
        default: 5,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(50)
    inflationRate?: number = 5;

    @ApiPropertyOptional({
        description: 'Estimasi return investasi tahunan untuk uang baru (%). Default: 10%',
        example: 10,
        default: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100)
    returnRate?: number = 10;
}