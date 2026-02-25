import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class VerifyOrderDto {
    @ApiProperty({
        description: 'ID Order Subscription yang akan divalidasi',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsNotEmpty()
    @IsUUID()
    orderId: string;

    @ApiProperty({
        description: 'Keputusan Admin: VALID (Setujui) atau INVALID (Tolak)',
        enum: VerificationStatus,
        example: VerificationStatus.VALID,
    })
    @IsNotEmpty()
    @IsEnum(VerificationStatus, {
        message: 'Status harus berupa VALID atau INVALID',
    })
    status: VerificationStatus;

    @ApiPropertyOptional({
        description: 'Catatan admin atau alasan penolakan (Wajib diisi jika INVALID agar tercatat di Audit Log)',
        example: 'Bukti transfer tidak terbaca / Nominal tidak sesuai',
    })
    @IsOptional()
    @IsString()
    adminNotes?: string;
}