import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: '10203040' })
  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
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
}