import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    Min,
    IsEnum,
    IsDateString,
    Max,
    IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * ENUM: Tipe Asuransi
 * Disamakan dengan logic di financial-math.util.ts
 */
export enum SimulationInsuranceType {
    LIFE = 'LIFE',
    HEALTH = 'HEALTH',
    CRITICAL_ILLNESS = 'CRITICAL_ILLNESS',
}

/**
 * DTO: Create Insurance Simulation
 * --------------------------------
 * Digunakan untuk fitur "Simulasi Agen" (Stateless).
 * Data ini tidak disimpan ke tabel 'InsurancePlan', melainkan hanya
 * diolah di memori untuk menghasilkan PDF report & token .mgc.
 */
export class CreateInsuranceSimulationDto {
    // ===========================================================================
    // GROUP 0: SYSTEM METADATA (Security & Idempotency)
    // ===========================================================================

    @ApiProperty({
        description: 'ID Unik Sesi Simulasi (UUID v4). Digunakan untuk membedakan revisi (gratis) vs sesi baru (bayar).',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsNotEmpty({ message: 'Session ID wajib disertakan.' })
    @IsUUID('4', { message: 'Session ID harus berupa UUID v4 yang valid.' })
    sessionId: string;

    // ===========================================================================
    // SECTION 1: CLIENT IDENTITY (Untuk Header Laporan PDF & Analytics)
    // ===========================================================================

    @ApiProperty({ example: 'Budi Santoso', description: 'Nama lengkap prospek/klien' })
    @IsString()
    @IsNotEmpty()
    clientName: string;

    @ApiProperty({ example: '1985-08-17', description: 'Tanggal lahir klien (ISO 8601)' })
    @IsDateString()
    @IsNotEmpty()
    clientDob: string;

    @ApiProperty({ example: 'Jakarta Selatan', description: 'Kota domisili klien' })
    @IsString()
    @IsNotEmpty()
    clientCity: string;

    @ApiProperty({ example: 'Manager Pemasaran', description: 'Pekerjaan klien' })
    @IsString()
    @IsNotEmpty()
    clientJob: string;

    @ApiPropertyOptional({ example: '08123456789', description: 'Nomor HP klien (Opsional untuk kontak)' })
    @IsOptional()
    @IsString()
    clientPhone?: string;

    // ===========================================================================
    // SECTION 2: CALCULATION PARAMETERS (Input Matematika)
    // ===========================================================================

    @ApiProperty({
        enum: SimulationInsuranceType,
        example: 'LIFE',
        description: 'Jenis proteksi yang ingin disimulasikan',
    })
    @IsEnum(SimulationInsuranceType)
    @IsNotEmpty()
    type: SimulationInsuranceType;

    // [UPDATED] Menggunakan nama 'dependents' agar sinkron dengan Template PDF
    @ApiProperty({ example: 2, description: 'Jumlah tanggungan (istri/anak)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    dependents: number = 0;

    @ApiProperty({ example: 15000000, description: 'Pengeluaran rutin bulanan keluarga' })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    monthlyExpense: number;

    @ApiProperty({ example: 500000000, description: 'Total sisa hutang berjalan (KPR/KPM)' })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    existingDebt: number;

    @ApiProperty({ example: 100000000, description: 'Uang Pertanggungan (UP) yang sudah dimiliki saat ini' })
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    existingCoverage: number;

    @ApiProperty({ example: 10, description: 'Durasi proteksi yang diinginkan (Tahun)' })
    @IsNumber()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    protectionDuration: number;

    // ===========================================================================
    // SECTION 3: ADVANCED PARAMETERS (Opsional / Assumptions)
    // ===========================================================================

    @ApiPropertyOptional({
        example: 25000000,
        description: 'Biaya akhir hayat (pemakaman, administrasi, dll). Default 0 jika kosong.',
        default: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    finalExpense?: number;

    @ApiPropertyOptional({
        example: 5,
        description: 'Asumsi tingkat inflasi tahunan (%). Default 5% di logic service.',
        default: 5,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    inflationRate?: number;

    @ApiPropertyOptional({
        example: 6,
        description: 'Asumsi return investasi tahunan (%). Default 6-7% di logic service.',
        default: 6,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    returnRate?: number;
}