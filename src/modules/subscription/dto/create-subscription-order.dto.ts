import { IsNotEmpty, IsUUID, IsNumber, Min, IsOptional } from 'class-validator'; // <-- 1. Import IsOptional
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionOrderDto {
    @ApiProperty({
        description: 'ID dari Plan yang dipilih (UUID)',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsNotEmpty()
    @IsUUID('4', { message: 'Plan ID harus berupa UUID yang valid' })
    planId: string;

    @ApiProperty({
        description: 'Kode unik suffix pembayaran untuk identifikasi mutasi rekening',
        example: 123,
    })
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @Min(0, { message: 'Kode unik tidak boleh negatif' })
    uniqueCode: number;

    @ApiProperty({
        type: 'string',
        format: 'binary',
        description: 'Bukti transfer (Gambar/PDF)',
    })
    @IsOptional() // <-- 2. TAMBAHKAN INI AGAR TIDAK DITOLAK VALIDATION PIPE
    proofFile: any;
}