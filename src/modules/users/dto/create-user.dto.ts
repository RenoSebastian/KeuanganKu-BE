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
    @IsOptional()
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
    @IsOptional()
    // Jika string kosong, ubah jadi null agar validator teriak "IsNotEmpty" bukan "Invalid UUID"
    @Transform(({ value }) => (value === '' ? null : value))
    unitKerjaId: string;

    @ApiProperty({ example: '1990-01-01', description: 'Tanggal lahir (Wajib)' })
    @IsDateString() // Ubah jadi Wajib karena DB require
    @IsOptional()
    dateOfBirth: string;

    @ApiPropertyOptional({ example: 0, description: 'Jumlah tanggungan' })
    @IsOptional()
    @IsNumber()
    dependentCount?: number;

    // =================================================================
    // [NEW] PHASE 4: ADDITIONAL PROFILE FIELDS (Admin Input)
    // =================================================================

    @ApiPropertyOptional({ example: 'Laki-laki', description: 'Jenis Kelamin' })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1', description: 'Alamat Domisili' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ example: 'PT Asuransi Sejahtera', description: 'Nama Perusahaan Agen' })
    @IsOptional()
    @IsString()
    agencyName?: string;

    @ApiPropertyOptional({ example: 'Senior Agent', description: 'Jabatan/Level Agen' })
    @IsOptional()
    @IsString()
    agentLevel?: string;
}