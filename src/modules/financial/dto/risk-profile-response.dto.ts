import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNumber,
    IsEnum,
    IsObject,
    ValidateNested,
    IsDateString,
    IsOptional
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Enum Kategori Profil Risiko.
 * Digunakan untuk standardisasi output kategori di FE dan BE.
 */
export enum RiskProfileCategory {
    KONSERVATIF = 'Konservatif',
    MODERAT = 'Moderat',
    AGRESIF = 'Agresif',
}

/**
 * Struktur Data Alokasi Aset.
 * [STANDARDISASI]: Menggunakan suffix 'Risk' (lowRisk, mediumRisk, highRisk)
 * untuk konsistensi dengan logika Frontend dan mencegah data undefined.
 */
export class RiskAllocationDto {
    @ApiProperty({ description: 'Persentase alokasi Low Risk (Pasar Uang/Deposito)', example: 20 })
    @IsNumber()
    lowRisk: number;

    @ApiProperty({ description: 'Persentase alokasi Medium Risk (Obligasi/Campuran)', example: 30 })
    @IsNumber()
    mediumRisk: number;

    @ApiProperty({ description: 'Persentase alokasi High Risk (Saham/Equity)', example: 50 })
    @IsNumber()
    highRisk: number;
}

/**
 * DTO Utama untuk Response & Export PDF Risk Profile.
 * ------------------------------------------------------------------
 * Note Technical:
 * DTO ini tidak memiliki properti `id` (database ID) karena didesain
 * untuk mendukung fitur "Agent Simulation" yang bersifat Stateless.
 * Data ini dibentuk on-the-fly di memory service.
 */
export class RiskProfileResponseDto {
    // --- SECTION 1: METADATA SIMULASI ---

    @ApiProperty({
        description: 'Timestamp waktu simulasi dilakukan (ISO String)',
        example: '2025-11-20T10:00:00Z'
    })
    @IsString()
    calculatedAt: string;

    @ApiProperty({ description: 'Nama klien (untuk Header Laporan)', example: 'Budi Santoso' })
    @IsString()
    clientName: string;

    @ApiPropertyOptional({
        description: 'Tanggal lahir klien (Opsional, untuk report age-based)',
        example: '1990-01-01'
    })
    @IsOptional()
    @IsDateString()
    clientDob?: string;

    // --- SECTION 2: HASIL KALKULASI (SCORING) ---

    @ApiProperty({
        description: 'Total skor hasil penjumlahan bobot jawaban kuesioner',
        example: 45
    })
    @IsNumber()
    totalScore: number;

    @ApiProperty({
        description: 'Kategori profil risiko hasil klasifikasi skor',
        enum: RiskProfileCategory,
        example: RiskProfileCategory.AGRESIF,
    })
    @IsEnum(RiskProfileCategory)
    riskProfile: RiskProfileCategory;

    @ApiProperty({
        description: 'Narasi penjelasan profil risiko untuk ditampilkan ke user',
        example: 'Anda memiliki toleransi tinggi terhadap fluktuasi pasar demi potensi imbal hasil maksimal.',
    })
    @IsString()
    riskDescription: string;

    // --- SECTION 3: REKOMENDASI ALOKASI ---

    @ApiProperty({
        description: 'Objek rekomendasi alokasi aset untuk visualisasi Pie Chart',
        type: RiskAllocationDto,
    })
    @IsObject()
    @ValidateNested()
    @Type(() => RiskAllocationDto) // [CRITICAL] Transformasi nested object agar tervalidasi dengan benar
    allocation: RiskAllocationDto;
}