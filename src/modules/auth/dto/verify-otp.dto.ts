import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
    @ApiProperty({
        description: 'Email pengguna yang meminta pemulihan',
        example: 'user@perusahaan.com',
    })
    @IsEmail({}, { message: 'Format email tidak valid.' })
    @IsNotEmpty({ message: 'Email tidak boleh kosong.' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    @ApiProperty({
        description: '6-digit kode OTP murni angka',
        example: '123456',
    })
    @IsString({ message: 'OTP harus berupa string.' })
    @IsNotEmpty({ message: 'Kode OTP tidak boleh kosong.' })
    @Matches(/^[0-9]{6}$/, {
        message: 'OTP harus berupa tepat 6 digit angka.'
    })
    otp: string;
}