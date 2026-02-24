import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { VerificationStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyOrderDto {
    @ApiProperty({
        description: 'ID Order Subscription yang akan divalidasi',
    })
    @IsNotEmpty()
    @IsUUID()
    orderId: string;

    @ApiProperty({
        description: 'Status keputusan Admin (VALID / INVALID)',
        enum: VerificationStatus,
        example: 'VALID',
    })
    @IsNotEmpty()
    @IsEnum(VerificationStatus, {
        message: 'Status harus berupa VALID atau INVALID',
    })
    status: VerificationStatus;

    @ApiPropertyOptional({
        description: 'Catatan admin jika ditolak (alasan)',
    })
    @IsOptional()
    @IsString()
    adminNotes?: string;
}