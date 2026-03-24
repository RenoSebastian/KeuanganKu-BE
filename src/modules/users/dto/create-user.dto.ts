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
    Matches
} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe', description: 'Nama lengkap agen/user' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'john@agency.com', description: 'Email unik user' })
    @IsEmail()
    @IsNotEmpty()
    @Transform(({ value }) => value?.toLowerCase().trim()) // Auto lowercase email
    email: string;

    @ApiPropertyOptional({ example: '12345678', description: 'Nomor Induk Agen / NIP' })
    @IsString()
    @IsOptional()
    nip?: string;

    @ApiProperty({ example: 'Rahasia123', description: 'Password awal' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ enum: Role, example: Role.USER, description: 'Role akses sistem' })
    @IsEnum(Role)
    @IsNotEmpty()
    role: Role;

    // [REFACTORED] Menggantikan unitKerjaId menjadi agencyId
    @ApiPropertyOptional({ example: 'uuid-agency-id', description: 'ID Agensi (Jika berafiliasi)' })
    @IsUUID()
    @IsOptional()
    @Transform(({ value }) => (value === '' ? null : value))
    agencyId?: string;

    // =================================================================
    // [NEW] PHASE 3: PHONE NUMBER INTEGRATION
    // =================================================================

    @ApiPropertyOptional({
        example: '08123456789',
        description: 'Nomor WhatsApp aktif untuk keperluan billing/tagihan'
    })
    @IsOptional()
    @IsString({ message: 'Nomor telepon harus berupa teks' })
    @Matches(/^[+0-9\s-]+$/, { message: 'Format nomor telepon mengandung karakter tidak valid' })
    phoneNumber?: string;

    @ApiPropertyOptional({ example: '1990-01-01', description: 'Tanggal lahir' })
    @IsDateString()
    @IsOptional()
    dateOfBirth?: string;

    @ApiPropertyOptional({ example: 0, description: 'Jumlah tanggungan' })
    @IsOptional()
    @IsNumber()
    dependentCount?: number;

    // =================================================================
    // PHASE 4: ADDITIONAL PROFILE FIELDS
    // =================================================================

    @ApiPropertyOptional({ example: 'Laki-laki', description: 'Jenis Kelamin' })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1', description: 'Alamat Domisili' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ example: 'PT Prudential Life', description: 'Nama Perusahaan Asuransi Induk' })
    @IsOptional()
    @IsString()
    companyName?: string;

    @ApiPropertyOptional({ example: 'Senior Agent', description: 'Jabatan/Level Agen' })
    @IsOptional()
    @IsString()
    agentLevel?: string;

    @ApiPropertyOptional({ example: 'Ingin mencapai MDRT tahun ini', description: 'Tujuan/Goal Agen' })
    @IsOptional()
    @IsString()
    goals?: string;
}