import { ApiProperty } from '@nestjs/swagger';

class PdfBufferData {
    @ApiProperty({ example: 'Buffer', description: 'Tipe data buffer Node.js' })
    type: 'Buffer';

    @ApiProperty({
        example: [37, 80, 68, 70],
        description: 'Array of bytes (Uint8Array) merepresentasikan file PDF',
        type: [Number]
    })
    data: number[];
}

export class EducationSimulationResponseDto {
    @ApiProperty({ example: 'success', description: 'Status eksekusi' })
    status: string;

    @ApiProperty({
        description: 'Data hasil kalkulasi backend untuk ditampilkan di UI (Grafik/Tabel)',
        example: {
            totalCost: 500000000,
            monthlySaving: 2500000,
            breakdown: []
        }
    })
    data: any; // Anda bisa memperjelas Type ini nanti jika ingin strict typing untuk UI

    @ApiProperty({ description: 'Buffer File PDF dalam format JSON standard Node.js' })
    pdfBuffer: PdfBufferData;

    @ApiProperty({
        example: 'Education_Plan_Budi_2024.pdf',
        description: 'Nama file yang disarankan untuk didownload'
    })
    filename: string;

    @ApiProperty({
        description: 'Token terenkripsi (.mgc) untuk menyimpan sesi simulasi',
        example: 'eyJhbGciOiJIUzI1NiIsIn...'
    })
    mgcToken: string;
}