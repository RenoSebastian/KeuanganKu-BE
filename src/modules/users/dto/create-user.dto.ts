import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
    IsDateString,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
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
    email: string;

    @ApiProperty({ example: 'Rahasia123', description: 'Password awal (min 6 karakter)' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ enum: Role, example: Role.USER, description: 'Role akses pegawai' })
    @IsEnum(Role)
    @IsNotEmpty()
    role: Role;

    @ApiPropertyOptional({ example: 'Staff IT', description: 'Jabatan pegawai' })
    @IsOptional()
    @IsString()
    jobTitle?: string;

    @ApiPropertyOptional({ example: '1990-01-01', description: 'Tanggal lahir (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @ApiPropertyOptional({ example: 0, description: 'Jumlah tanggungan (anak/istri)' })
    @IsOptional()
    @IsNumber()
    dependentCount?: number;
}