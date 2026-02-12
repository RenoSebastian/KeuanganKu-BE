import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';

/**
 * Class untuk merepresentasikan satu jawaban pertanyaan.
 * Digunakan di dalam array 'answers'.
 */
export class RiskProfileAnswerItemDto {
    @ApiProperty({
        description: 'ID unik dari pertanyaan (sesuai constant di Backend/Frontend)',
        example: 'q1',
    })
    @IsNotEmpty()
    @IsString()
    questionId: string;

    @ApiProperty({
        description: 'Nilai skor dari jawaban yang dipilih (weight)',
        example: 10,
    })
    @IsNumber()
    @Min(0)
    value: number;
}

/**
 * DTO Utama untuk Simulasi Risk Profile (Agent Mode).
 * Data ini bersifat Stateless (tidak wajib simpan DB), digunakan untuk:
 * 1. Kalkulasi Skor & Profil
 * 2. Generate PDF Report
 * 3. Generate Token (.mgc)
 */
export class CreateRiskProfileSimulationDto {
    // --- SECTION 1: IDENTITAS KLIEN (KYC SEDERHANA) ---

    @ApiProperty({
        description: 'Nama lengkap klien untuk ditampilkan di Header Laporan PDF',
        example: 'Budi Santoso',
    })
    @IsString()
    @IsNotEmpty({ message: 'Nama klien wajib diisi' })
    clientName: string;

    @ApiProperty({
        description: 'Tanggal lahir klien (YYYY-MM-DD). Penting untuk validasi profil risiko berdasarkan usia.',
        example: '1990-05-15',
    })
    @IsDateString({}, { message: 'Format tanggal lahir harus ISO 8601 (YYYY-MM-DD)' })
    @IsNotEmpty({ message: 'Tanggal lahir klien wajib diisi' })
    clientDob: string;

    @ApiPropertyOptional({
        description: 'Nomor HP klien (Opsional, untuk kelengkapan data di PDF)',
        example: '08123456789',
    })
    @IsOptional()
    @IsString()
    clientPhone?: string;

    @ApiPropertyOptional({
        description: 'Pekerjaan klien (Opsional, untuk kelengkapan data di PDF)',
        example: 'Wiraswasta',
    })
    @IsOptional()
    @IsString()
    clientJob?: string;

    @ApiPropertyOptional({
        description: 'Kota domisili klien (Opsional, untuk kelengkapan data di PDF)',
        example: 'Jakarta Selatan',
    })
    @IsOptional()
    @IsString()
    clientCity?: string;

    // --- SECTION 2: JAWABAN KUESIONER ---

    @ApiProperty({
        description: 'Array jawaban kuesioner. Total skor akan dihitung dari sini.',
        type: [RiskProfileAnswerItemDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RiskProfileAnswerItemDto)
    @IsNotEmpty({ message: 'Jawaban kuesioner tidak boleh kosong' })
    answers: RiskProfileAnswerItemDto[];
}