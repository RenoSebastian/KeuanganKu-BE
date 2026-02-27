import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: '10203040' })
  @IsString()
  @IsOptional()
  nip: string;

  @ApiProperty({ example: 'budi@pamjaya.co.id' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'RahasiaNegara123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'IT-001' })
  @IsString()
  @IsOptional()
  unitKerjaId: string; // Nanti kita seed Unit Kerja dulu
}

export class LoginDto {
  @ApiProperty({ example: 'budi@pamjaya.co.id' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'RahasiaNegara123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  // [UPDATE] Jadikan Optional.
  // Jika dikirim, FE bisa kirim kode "IT-01", "FIN-01".
  // Jika tidak dikirim, Backend akan set ke default "IT-01".
  @ApiProperty({ example: 'IT-01', required: false })
  @IsString()
  @IsOptional()
  unitKerjaId?: string;

  // ====================================================================
  // [NEW] SINGLE CONCURRENT SESSION IDENTIFIER
  // ====================================================================
  // Atribut ini wajib. Di Controller, kita akan menangkapnya dari
  // HTTP Header 'x-device-id' dan memasukkannya ke payload ini.
  @ApiProperty({
    example: 'c2f7b8a1-3d9a-4f81-9b62-1b8a5d4c3f91',
    description: 'Device Fingerprint / AppMySite Client ID'
  })
  @IsString()
  @IsNotEmpty({ message: 'Device ID tidak boleh kosong untuk pelacakan sesi' })
  deviceId: string;
}

// ====================================================================
// [NEW] DTO UNTUK REFRESH TOKEN ROTATION
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
  @IsNotEmpty({ message: 'Device ID wajib disertakan untuk validasi rotasi token' })
  deviceId: string;
}