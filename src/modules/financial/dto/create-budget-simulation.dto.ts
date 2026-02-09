import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateBudgetSimulationDto
 * -------------------------
 * Data Transfer Object untuk menangani input simulasi budgeting dari Agen.
 * * Logic Validation:
 * 1. Data Identitas (Name, DOB, Phone) -> Digunakan untuk Header PDF & File .mgc.
 * 2. Data Demografi (City, Job) -> Wajib ada untuk kebutuhan Analitik (OLAP) di tabel SimulationLog.
 * 3. Data Finansial (Income) -> Wajib valid angka positif.
 */
export class CreateBudgetSimulationDto {
    // ===========================================================================
    // GROUP 1: CLIENT IDENTITY (Ephemeral - Not Saved to DB Analytics)
    // ===========================================================================

    @IsNotEmpty({ message: 'Nama Klien wajib diisi untuk keperluan laporan.' })
    @IsString()
    clientName: string;

    @IsNotEmpty({ message: 'Tanggal Lahir wajib diisi untuk menghitung umur otomatis.' })
    @IsDateString({}, { message: 'Format Tanggal Lahir harus ISO 8601 (YYYY-MM-DD).' })
    clientDob: string;

    @IsOptional()
    @IsString()
    clientPhone?: string;

    // ===========================================================================
    // GROUP 2: DEMOGRAPHICS (For Analytics / SimulationLog)
    // ===========================================================================

    @IsNotEmpty({ message: 'Kota domisili wajib diisi untuk data analitik.' })
    @IsString()
    clientCity: string;

    @IsNotEmpty({ message: 'Pekerjaan wajib diisi untuk data analitik.' })
    @IsString()
    clientJob: string;

    // ===========================================================================
    // GROUP 3: FINANCIAL DATA (Core Calculation Logic)
    // ===========================================================================

    /**
     * Fixed Income (Gaji Tetap).
     * Validasi Keras: Harus angka dan minimal 0.
     * Logic: Ini adalah basis 'multiplier' untuk alokasi 45/15/20/10/10.
     */
    @IsNotEmpty({ message: 'Gaji Tetap wajib diisi.' })
    @Type(() => Number) // Memastikan payload string dari form-data dikonversi ke Number
    @IsNumber({}, { message: 'Gaji Tetap harus berupa angka.' })
    @Min(0, { message: 'Gaji Tetap tidak boleh negatif.' })
    fixedIncome: number;

    /**
     * Variable Income (Gaji Tidak Tetap).
     * Opsional: Default 0 jika tidak dikirim.
     * Logic: Tidak masuk rumus persentase, tapi langsung dianggap Surplus/Tabungan Extra.
     */
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Gaji Variabel harus berupa angka.' })
    @Min(0, { message: 'Gaji Variabel tidak boleh negatif.' })
    variableIncome?: number = 0;
}