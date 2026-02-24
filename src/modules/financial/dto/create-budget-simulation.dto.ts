import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, IsDateString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBudgetSimulationDto {
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
    // GROUP 1: CLIENT IDENTITY (Untuk PDF & File .mgc)
    // ===========================================================================

    @ApiProperty({
        description: 'Nama lengkap klien (akan dicetak di PDF)',
        example: 'Budi Santoso',
    })
    @IsNotEmpty({ message: 'Nama Klien wajib diisi.' })
    @IsString()
    clientName: string;

    @ApiProperty({
        description: 'Tanggal lahir klien (Format ISO YYYY-MM-DD)',
        example: '1990-05-20',
    })
    @IsNotEmpty({ message: 'Tanggal Lahir wajib diisi.' })
    @IsDateString({}, { message: 'Format Tanggal Lahir harus ISO 8601 (YYYY-MM-DD).' })
    clientDob: string;

    @ApiPropertyOptional({
        description: 'Nomor HP Klien (Opsional)',
        example: '081234567890',
    })
    @IsOptional()
    @IsString()
    clientPhone?: string;

    // ===========================================================================
    // GROUP 2: DEMOGRAPHICS (Untuk Analitik Data)
    // ===========================================================================

    @ApiProperty({
        description: 'Kota domisili klien',
        example: 'Bandung',
    })
    @IsNotEmpty({ message: 'Kota domisili wajib diisi.' })
    @IsString()
    clientCity: string;

    @ApiProperty({
        description: 'Pekerjaan klien',
        example: 'Wiraswasta',
    })
    @IsNotEmpty({ message: 'Pekerjaan wajib diisi.' })
    @IsString()
    clientJob: string;

    // ===========================================================================
    // GROUP 3: FINANCIAL DATA (Untuk Rumus Budgeting)
    // ===========================================================================

    @ApiProperty({
        description: 'Penghasilan Tetap Bulanan (Gaji Pokok)',
        example: 10000000,
        minimum: 0,
    })
    @IsNotEmpty({ message: 'Gaji Tetap wajib diisi.' })
    @Type(() => Number)
    @IsNumber({}, { message: 'Gaji Tetap harus berupa angka.' })
    @Min(0, { message: 'Gaji Tetap tidak boleh negatif.' })
    fixedIncome: number;

    @ApiPropertyOptional({
        description: 'Penghasilan Tidak Tetap / Bonus (Akan dialokasikan ke Surplus)',
        example: 2500000,
        default: 0,
        minimum: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Gaji Variabel harus berupa angka.' })
    @Min(0, { message: 'Gaji Variabel tidak boleh negatif.' })
    variableIncome?: number = 0;
}