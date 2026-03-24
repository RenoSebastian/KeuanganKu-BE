import { IsEmail, IsNotEmpty, IsString, MinLength, Length, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ====================================================================
// 1. REGISTER DTO (Agent Profile)
// ====================================================================
export class RegisterDto {
  @ApiProperty({ example: 'budi.agent@gmail.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email wajib diisi' })
  email: string;

  @ApiProperty({ example: 'RahasiaAgen123' })
  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @ApiProperty({ example: 'Budi Santoso, RFP' })
  @IsString()
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  fullName: string;

  // [NEW] Fase 3: Integrasi Nomor Telepon
  @ApiPropertyOptional({
    example: '08123456789',
    description: 'Nomor WhatsApp (Opsional saat daftar awal)'
  })
  @IsOptional()
  @IsString({ message: 'Nomor telepon harus berupa teks' })
  // Regex untuk membatasi input agar hanya menerima angka, spasi, dash (-), dan plus (+)
  @Matches(/^[+0-9\s-]+$/, { message: 'Format nomor telepon mengandung karakter tidak valid' })
  phoneNumber?: string;
}

// ====================================================================
// 2. LOGIN DTO (Initiation Phase)
// ====================================================================
export class LoginDto {
  @ApiProperty({ example: 'budi.agent@gmail.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email wajib diisi' })
  email: string;

  @ApiProperty({ example: 'RahasiaAgen123' })
  @IsString()
  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  password: string;

  // [CLEANUP]: Menghapus unitKerjaId karena aplikasi sudah pivot ke SaaS Agen mandiri.
  // Device ID tetap wajib untuk mendukung Single Concurrent Session paska-login.
  @ApiProperty({
    example: 'c2f7b8a1-3d9a-4f81-9b62-1b8a5d4c3f91',
    description: 'Device Fingerprint untuk pelacakan sesi'
  })
  @IsString()
  @IsNotEmpty({ message: 'Device ID wajib disertakan untuk keamanan sesi' })
  deviceId: string;
}

// ====================================================================
// 3. VERIFY OTP DTO (Digunakan untuk Registrasi & Login 2FA)
// ====================================================================
export class VerifyOtpDto {
  @ApiProperty({ example: 'budi.agent@gmail.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email wajib diisi' })
  email: string;

  @ApiProperty({ example: '123456', description: '6 digit kode OTP dari email' })
  @IsString()
  @IsNotEmpty({ message: 'Kode OTP tidak boleh kosong' })
  @Length(6, 6, { message: 'Kode OTP wajib 6 digit' })
  otpCode: string;

  @ApiProperty({
    example: 'c2f7b8a1-3d9a-4f81-9b62-1b8a5d4c3f91',
    description: 'Device ID diperlukan untuk otorisasi sesi otomatis'
  })
  @IsString()
  @IsNotEmpty({ message: 'Device ID diperlukan untuk keamanan sesi' })
  deviceId: string;
}

// ====================================================================
// 4. RESEND OTP DTO (Digunakan untuk Registrasi & Login 2FA)
// ====================================================================
export class ResendOtpDto {
  @ApiProperty({ example: 'budi.agent@gmail.com' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email wajib diisi' })
  email: string;
}

// ====================================================================
// 5. REFRESH TOKEN DTO
// ====================================================================
export class RefreshTokenDto {
  @ApiProperty({
    example: 'd8a...[opaque_token_string]...',
    description: 'Long-lived Refresh Token'
  })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token wajib disertakan' })
  refreshToken: string;

  @ApiProperty({
    example: 'c2f7b8a1-3d9a-4f81-9b62-1b8a5d4c3f91',
    description: 'Harus cocok dengan perangkat saat login awal'
  })
  @IsString()
  @IsNotEmpty({ message: 'Device ID wajib disertakan' })
  deviceId: string;
}