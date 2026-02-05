import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
} from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'John Doe', description: 'Nama lengkap agen' })
    @IsString()
    @IsNotEmpty({ message: 'Nama tidak boleh kosong' })
    nama: string;

    @ApiProperty({ example: 'john@agen.com', description: 'Email unik agen' })
    @IsEmail({}, { message: 'Format email tidak valid' })
    @IsNotEmpty({ message: 'Email tidak boleh kosong' })
    @Transform(({ value }) => value?.toLowerCase().trim()) // Auto lowercase & trim
    email: string;

    @ApiProperty({ example: 'Rahasia123', description: 'Password akun (min 6 karakter)' })
    @IsString()
    @IsNotEmpty({ message: 'Password tidak boleh kosong' })
    @MinLength(6, { message: 'Password minimal 6 karakter' })
    password: string;
}