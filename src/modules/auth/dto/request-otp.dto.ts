import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestOtpDto {
    @ApiProperty({
        description: 'Email pengguna yang terdaftar di sistem',
        example: 'user@perusahaan.com',
    })
    @IsEmail({}, { message: 'Format email tidak valid.' })
    @IsNotEmpty({ message: 'Email tidak boleh kosong.' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;
}