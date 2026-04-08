import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
    MinLength,
    MaxLength,
    IsUUID,
} from 'class-validator';

// ============================================================================
// HELPER: DATA TRANSFORMER
// ============================================================================

/**
 * Menambal celah payload dari Frontend.
 * Memaksa nilai undefined, null, string kosong "", atau string non-numerik menjadi angka 0 mutlak.
 * Mencegah injeksi nilai yang menyebabkan Exception NaN pada komputasi layanan inti.
 */
const TransformEmptyToZero = Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 0;
    const parsedValue = Number(value);
    return isNaN(parsedValue) ? 0 : parsedValue;
});

// ============================================================================
// ENUMS
// ============================================================================

export enum Gender {
    MALE = 'L',
    FEMALE = 'P',
}

export enum MaritalStatus {
    SINGLE = 'SINGLE',
    MARRIED = 'MARRIED',
    DIVORCED = 'DIVORCED',
}

// ============================================================================
// SUB-DTOS (NESTED OBJECTS)
// ============================================================================

/**
 * Sub-DTO: Data Pasangan (Spouse)
 * Digunakan jika status klien adalah MARRIED.
 */
export class SimulationSpouseProfileDto {
    @ApiProperty({ description: 'Nama lengkap pasangan', example: 'Ratna Sari' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiPropertyOptional({ description: 'Tanggal lahir pasangan (YYYY-MM-DD)', example: '1988-03-15' })
    @IsOptional()
    @IsDateString()
    dob?: string;

    @ApiPropertyOptional({ description: 'Pekerjaan pasangan', example: 'Ibu Rumah Tangga' })
    @IsOptional()
    @IsString()
    occupation?: string;
}

/**
 * Sub-DTO: Profil Lengkap Klien (KYC)
 * Mengandung semua data demografi yang diperlukan untuk laporan PDF profesional.
 */
export class SimulationClientProfileDto {
    @ApiProperty({ description: 'Nama lengkap klien', example: 'Budi Santoso' })
    @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
    @IsString()
    @MinLength(3)
    name: string;

    @ApiPropertyOptional({ description: 'Nomor Induk Kependudukan (Opsional)', example: '3201123456780001' })
    @IsOptional()
    @IsString()
    @MaxLength(16)
    nik?: string;

    @ApiProperty({ description: 'Tanggal lahir klien (YYYY-MM-DD)', example: '1985-08-17' })
    @IsNotEmpty({ message: 'Tanggal lahir wajib diisi' })
    @IsDateString()
    dob: string;

    @ApiProperty({ description: 'Jenis Kelamin (L/P)', enum: Gender, example: 'L' })
    @IsNotEmpty()
    @IsEnum(Gender)
    gender: Gender;

    @ApiProperty({ description: 'Kota domisili saat ini', example: 'Jakarta Selatan' })
    @IsNotEmpty()
    @IsString()
    city: string;

    @ApiProperty({ description: 'Alamat lengkap', example: 'Jl. Sudirman No. 1' })
    @IsNotEmpty()
    @IsString()
    address: string;

    @ApiProperty({ description: 'Nomor HP/WhatsApp aktif', example: '081234567890' })
    @IsNotEmpty()
    @IsString()
    phone: string;

    @ApiPropertyOptional({ description: 'Alamat Email', example: 'budi@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ description: 'Pekerjaan saat ini', example: 'Manager Marketing' })
    @IsNotEmpty()
    @IsString()
    occupation: string;

    @ApiProperty({ description: 'Status Pernikahan', enum: MaritalStatus, example: 'MARRIED' })
    @IsNotEmpty()
    @IsEnum(MaritalStatus)
    maritalStatus: MaritalStatus;

    @ApiPropertyOptional({ description: 'Agama', example: 'Islam' })
    @IsOptional()
    @IsString()
    religion?: string;

    @ApiPropertyOptional({ description: 'Jumlah Anak', example: 2, default: 0 })
    @IsOptional()
    @TransformEmptyToZero
    @IsNumber()
    @Min(0)
    childrenCount?: number;

    @ApiPropertyOptional({ description: 'Jumlah Tanggungan Orang Tua', example: 1, default: 0 })
    @IsOptional()
    @TransformEmptyToZero
    @IsNumber()
    @Min(0)
    dependentParents?: number;
}

// ============================================================================
// MAIN DTO
// ============================================================================

/**
 * MAIN DTO: CreateCheckupSimulationDto
 * ------------------------------------
 * Payload utama untuk endpoint /simulation/checkup.
 * Menggabungkan Profil Klien (KYC) dan Data Finansial (Financial Record)
 * dalam satu paket untuk diproses secara Stateless.
 */
export class CreateCheckupSimulationDto {
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

    // --- SECTION 1: IDENTITAS KLIEN ---

    @ApiProperty({ type: SimulationClientProfileDto, description: 'Data diri lengkap klien' })
    @ValidateNested()
    @Type(() => SimulationClientProfileDto)
    @IsNotEmpty()
    client: SimulationClientProfileDto;

    @ApiPropertyOptional({ type: SimulationSpouseProfileDto, description: 'Data pasangan (jika menikah)' })
    @IsOptional()
    @ValidateNested()
    @Type(() => SimulationSpouseProfileDto)
    spouse?: SimulationSpouseProfileDto;

    // --- SECTION 2: FINANCIAL DATA (SNAPSHOT & FLOW) ---
    // Mengganti @Type(() => Number) dengan @TransformEmptyToZero untuk standarisasi kontrak

    // --- A. ASET LIKUID (CASH) ---
    @ApiProperty({ description: 'Total uang tunai & tabungan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetCash: number;

    // --- B. ASET PERSONAL (PAKAI) ---
    @ApiProperty({ description: 'Nilai properti rumah tinggal', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetHome: number;

    @ApiProperty({ description: 'Nilai kendaraan pribadi', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetVehicle: number;

    @ApiProperty({ description: 'Nilai perhiasan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetJewelry: number;

    @ApiProperty({ description: 'Nilai barang antik/koleksi', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetAntique: number;

    @ApiProperty({ description: 'Aset personal lainnya', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetPersonalOther: number;

    // --- C. ASET INVESTASI (TUMBUH) ---
    @ApiProperty({ description: 'Properti investasi (sewaan)', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetInvHome: number;

    @ApiProperty({ description: 'Kendaraan niaga', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetInvVehicle: number;

    @ApiProperty({ description: 'Logam mulia / Emas', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetGold: number;

    @ApiProperty({ description: 'Barang koleksi bernilai investasi', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetInvAntique: number;

    @ApiProperty({ description: 'Saham', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetStocks: number;

    @ApiProperty({ description: 'Reksa Dana', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetMutualFund: number;

    @ApiProperty({ description: 'Obligasi / Surat Berharga', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetBonds: number;

    @ApiProperty({ description: 'Deposito', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetDeposit: number;

    @ApiProperty({ description: 'Investasi lainnya', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    assetInvOther: number;

    // --- E. UTANG KONSUMTIF ---
    @ApiProperty({ description: 'Sisa pokok utang KPR', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    debtKPR: number;

    @ApiProperty({ description: 'Sisa pokok utang Kendaraan (KPM)', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    debtKPM: number;

    @ApiProperty({ description: 'Sisa utang Kartu Kredit', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    debtCC: number;

    @ApiProperty({ description: 'Sisa utang Koperasi/Pinjaman Kantor', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    debtCoop: number;

    @ApiProperty({ description: 'Utang konsumtif lainnya (Pinjol dll)', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    debtConsumptiveOther: number;

    // --- F. UTANG PRODUKTIF ---
    @ApiProperty({ description: 'Sisa utang modal usaha', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    debtBusiness: number;

    // --- I. ARUS KAS MASUK (INCOME) ---
    @ApiProperty({ description: 'Penghasilan Tetap (Gaji) per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    incomeFixed: number;

    @ApiProperty({ description: 'Penghasilan Variabel (Bonus/Sidejob) Rata-rata per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    incomeVariable: number;

    // --- K. ARUS KAS KELUAR (EXPENSE - DEBT) ---
    @ApiProperty({ description: 'Cicilan KPR per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    installmentKPR: number;

    @ApiProperty({ description: 'Cicilan KPM per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    installmentKPM: number;

    @ApiProperty({ description: 'Tagihan Kartu Kredit per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    installmentCC: number;

    @ApiProperty({ description: 'Potongan Koperasi per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    installmentCoop: number;

    @ApiProperty({ description: 'Cicilan Konsumtif Lain per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    installmentConsumptiveOther: number;

    @ApiProperty({ description: 'Cicilan Utang Usaha per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    installmentBusiness: number;

    // --- L. ARUS KAS KELUAR (EXPENSE - INSURANCE) ---
    @ApiProperty({ description: 'Premi Asuransi Jiwa per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    insuranceLife: number;

    @ApiProperty({ description: 'Premi Asuransi Kesehatan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    insuranceHealth: number;

    @ApiProperty({ description: 'Premi Asuransi Rumah per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    insuranceHome: number;

    @ApiProperty({ description: 'Premi Asuransi Kendaraan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    insuranceVehicle: number;

    @ApiProperty({ description: 'Iuran BPJS Kesehatan & Ketenagakerjaan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    insuranceBPJS: number;

    @ApiProperty({ description: 'Premi Asuransi Lainnya per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    insuranceOther: number;

    // --- M. ARUS KAS KELUAR (SAVING / INVESTASI) ---
    @ApiProperty({ description: 'Tabungan Pendidikan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    savingEducation: number;

    @ApiProperty({ description: 'Tabungan Pensiun/DPLK per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    savingRetirement: number;

    @ApiProperty({ description: 'Tabungan Ibadah (Haji/Umrah) per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    savingPilgrimage: number;

    @ApiProperty({ description: 'Tabungan Liburan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    savingHoliday: number;

    @ApiProperty({ description: 'Tabungan Dana Darurat per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    savingEmergency: number;

    @ApiProperty({ description: 'Investasi Lainnya per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    savingOther: number;

    // --- N. ARUS KAS KELUAR (LIVING COST) ---
    @ApiProperty({ description: 'Belanja Dapur & Makan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseFood: number;

    @ApiProperty({ description: 'SPP Sekolah & Les per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseSchool: number;

    @ApiProperty({ description: 'Transportasi & Bensin per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseTransport: number;

    @ApiProperty({ description: 'Listrik, Air, Pulsa, Internet per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseCommunication: number;

    @ApiProperty({ description: 'Gaji ART / Keamanan per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseHelpers: number;

    @ApiProperty({ description: 'Pajak (PBB/STNK) disetahunkan dibagi 12', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseTax: number;

    @ApiProperty({ description: 'Gaya Hidup (Nonton/Cafe) per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseLifestyle: number;

    @ApiProperty({ description: 'Pengeluaran gaya hidup / kebutuhan lainnya per Bulan', default: 0 })
    @IsOptional() @TransformEmptyToZero @IsNumber() @Min(0)
    expenseOther: number;
}