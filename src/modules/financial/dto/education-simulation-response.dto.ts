import { ApiProperty } from '@nestjs/swagger';

/**
 * Merepresentasikan struktur JSON dari Buffer Node.js
 * Saat Buffer dikirim via JSON, ia otomatis berubah menjadi { type: 'Buffer', data: [...] }
 */
class PdfBufferData {
    @ApiProperty({
        example: 'Buffer',
        description: 'Identifier tipe data buffer Node.js'
    })
    type: 'Buffer';

    @ApiProperty({
        example: [37, 80, 68, 70, 45, 49, 46, 54], // Contoh bytes header PDF (%PDF-1.6)
        description: 'Array of bytes (Uint8Array) yang merepresentasikan file PDF',
        type: [Number]
    })
    data: number[];
}

/**
 * Struktur Data Hasil Kalkulasi (untuk UI)
 */
class EducationCalculationResult {
    @ApiProperty({ example: 415272, description: 'Total biaya masa depan untuk semua anak' })
    totalFutureCost: number;

    @ApiProperty({ example: 8979, description: 'Total tabungan bulanan yang direkomendasikan' })
    totalMonthlySaving: number;

    @ApiProperty({
        example: [],
        description: 'Detail rencana per anak dan per jenjang',
        isArray: true
    })
    childrenPlans: any[]; // Bisa diperdetail dengan class lain jika perlu, tapi 'any' cukup untuk output dynamic
}

export class EducationSimulationResponseDto {
    @ApiProperty({
        example: 'success',
        description: 'Status eksekusi request'
    })
    status: string;

    @ApiProperty({
        description: 'Data hasil kalkulasi backend untuk visualisasi UI (Grafik/Ringkasan)',
        type: EducationCalculationResult
    })
    data: EducationCalculationResult;

    @ApiProperty({
        description: 'Buffer File PDF dalam format JSON standard Node.js. Frontend harus mengonversinya menjadi Blob.',
        type: PdfBufferData
    })
    pdfBuffer: PdfBufferData;

    @ApiProperty({
        example: 'Education_Plan_Budi_2026.pdf',
        description: 'Nama file yang disarankan untuk proses unduhan'
    })
    filename: string;

    @ApiProperty({
        description: 'Token terenkripsi (.mgc) berisi snapshot sesi untuk fitur Load/Import',
        example: 'eyJhbGciOiJIUzI1NiIsIn...'
    })
    mgcToken: string;
}