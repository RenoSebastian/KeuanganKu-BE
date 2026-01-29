import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MinLength,
} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe', description: 'Nama lengkap pegawai' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'john@kantor.com', description: 'Email unik pegawai' })
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) => value?.toLowerCase().trim()) // Auto lowercase email
    email: string;

    @ApiProperty({ example: '12345678', description: 'NIP Pegawai' })
    @IsString()
    @IsNotEmpty()
    nip: string;

    @ApiProperty({ example: 'Rahasia123', description: 'Password awal' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ enum: Role, example: Role.USER, description: 'Role akses pegawai' })
    @IsEnum(Role)
    @IsNotEmpty()
    role: Role;

    @ApiProperty({ example: 'uuid-unit-kerja', description: 'ID Unit Kerja' })
    @IsUUID()
    @IsNotEmpty()
    // Jika string kosong, ubah jadi null agar validator teriak "IsNotEmpty" bukan "Invalid UUID"
    @Transform(({ value }) => (value === '' ? null : value))
    unitKerjaId: string;

    @ApiProperty({ example: '1990-01-01', description: 'Tanggal lahir (Wajib)' })
    @IsDateString() // Ubah jadi Wajib karena DB require
    @IsNotEmpty()
    dateOfBirth: string;

    @ApiPropertyOptional({ example: 'Staff IT', description: 'Jabatan pegawai' })
    @IsOptional()
    @IsString()
    jobTitle?: string;

    @ApiPropertyOptional({ example: 0, description: 'Jumlah tanggungan' })
    @IsOptional()
    @IsNumber()
    dependentCount?: number;
}