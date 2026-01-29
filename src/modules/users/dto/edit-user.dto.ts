import { IsOptional, IsString, IsNumber, IsDateString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string; // [FIX] Field Avatar Base64

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dependentCount?: number; // [FIX] Jumlah Tanggungan

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  // @IsDateString() // Opsional: Bisa diaktifkan jika format strict ISO
  dateOfBirth?: string; // [FIX] Tanggal Lahir (String dari input type="date")
}