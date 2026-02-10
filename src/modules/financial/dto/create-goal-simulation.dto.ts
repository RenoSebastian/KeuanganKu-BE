import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsNotEmpty,
    IsString,
    IsNumber,
    Min,
    Max,
    IsOptional,
    IsDateString,
    MinLength
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO: CreateGoalSimulationDto
 * -------------------------------------------------------------------------
 * Data Transfer Object untuk menangani input simulasi Tujuan Keuangan (Stateless).
 * * * Architectural Note:
 * DTO ini didesain untuk tidak terikat langsung dengan tabel database 'GoalPlan'.
 * Data yang dikirim bersifat transient (sementara) untuk diolah menjadi:
 * 1. Kalkulasi Matematika (Future Value & PMT).
 * 2. Laporan PDF (Buffer).
 * 3. Token .mgc (Restore capability).
 * * * New Feature Update:
 * Penambahan field 'currentSaving' memungkinkan perhitungan GAP yang lebih realistis.
 * Logic: (Future Value Barang - Future Value Modal Awal) = Kekurangan Dana.
 */
export class CreateGoalSimulationDto {

    // =======================================================================
    // SEGMENT 1: CLIENT IDENTITY (Metadata Laporan)
    // =======================================================================

    @ApiProperty({
        description: 'Nama lengkap klien untuk dicetak pada header laporan',
        example: 'Indra Wijaya',
    })
    @IsNotEmpty({ message: 'Nama klien wajib diisi' })
    @IsString()
    clientName: string;

    @ApiProperty({
        description: 'Tanggal lahir klien (ISO 8601). Digunakan untuk validasi usia produktif.',
        example: '1990-05-20',
    })
    @IsNotEmpty({ message: 'Tanggal lahir wajib diisi' })
    @IsDateString()
    clientDob: string;

    @ApiProperty({
        description: 'Kota domisili klien',
        example: 'Surabaya',
    })
    @IsNotEmpty({ message: 'Kota domisili wajib diisi' })
    @IsString()
    clientCity: string;

    @ApiPropertyOptional({
        description: 'Pekerjaan klien saat ini (Opsional, untuk konteks analisa)',
        example: 'Wiraswasta',
    })
    @IsOptional()
    @IsString()
    clientJob?: string;

    @ApiPropertyOptional({
        description: 'Nomor HP klien untuk referensi kontak (Opsional)',
        example: '081299998888',
    })
    @IsOptional()
    @IsString()
    clientPhone?: string;

    // =======================================================================
    // SEGMENT 2: GOAL PARAMETERS (Financial Targets)
    // =======================================================================

    @ApiProperty({
        description: 'Nama Tujuan Keuangan (misal: "Dana Nikah", "DP Rumah")',
        example: 'DP Rumah Impian',
    })
    @IsNotEmpty({ message: 'Nama tujuan wajib diisi' })
    @IsString()
    @MinLength(3, { message: 'Nama tujuan minimal 3 karakter' })
    goalName: string;

    @ApiProperty({
        description: 'Harga barang/jasa SAAT INI (Present Value). Backend akan menghitung inflasinya.',
        example: 150000000,
        minimum: 1000000,
    })
    @IsNotEmpty({ message: 'Harga target saat ini wajib diisi' })
    @Type(() => Number)
    @IsNumber()
    @Min(0, { message: 'Target dana tidak boleh negatif' })
    targetAmount: number;

    @ApiPropertyOptional({
        description: 'Modal awal / Tabungan yang sudah ada untuk tujuan ini (Rp). Default: 0',
        example: 25000000,
        default: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0, { message: 'Modal awal tidak boleh negatif' })
    currentSaving?: number = 0;

    @ApiProperty({
        description: 'Target tanggal pencapaian tujuan (Format: YYYY-MM-DD)',
        example: '2030-01-01',
    })
    @IsNotEmpty({ message: 'Target tanggal wajib diisi' })
    @IsDateString({}, { message: 'Format tanggal harus valid (YYYY-MM-DD)' })
    targetDate: string;

    // =======================================================================
    // SEGMENT 3: ECONOMIC ASSUMPTIONS (Assumption Sliders)
    // =======================================================================

    @ApiPropertyOptional({
        description: 'Asumsi tingkat inflasi tahunan (%). Digunakan untuk menghitung Future Cost. Default: 5%',
        example: 5.0,
        default: 5,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(50, { message: 'Rate inflasi tidak realistis (>50%)' })
    inflationRate?: number = 5;

    @ApiPropertyOptional({
        description: 'Estimasi return investasi tahunan (%). Digunakan untuk menghitung pertumbuhan modal. Default: 6%',
        example: 8.0,
        default: 6,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100, { message: 'Return investasi tidak realistis (>100%)' })
    returnRate?: number = 6;
}