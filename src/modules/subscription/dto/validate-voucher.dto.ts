import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateVoucherDto {
    @ApiProperty({ description: 'Kode voucher yang ingin divalidasi', example: 'ENGINE50' })
    @IsNotEmpty({ message: 'Kode voucher wajib diisi' })
    @IsString()
    code: string;

    @ApiProperty({ description: 'ID paket langganan yang dipilih', example: 'uuid' })
    @IsNotEmpty({ message: 'Plan ID wajib diisi' })
    @IsUUID('4', { message: 'Plan ID harus berupa UUID yang valid' })
    planId: string;
}
