import { IsEnum, IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RetentionEntityType } from './export-query.dto';

export class PruneExecutionDto {
    @ApiProperty({
        enum: RetentionEntityType,
        description: 'Target data entitas yang akan dimusnahkan secara permanen.',
        example: 'FINANCIAL_CHECKUP',
    })
    @IsEnum(RetentionEntityType, {
        message: 'Entity Type tidak valid. Pilih entitas yang tersedia.',
    })
    @IsNotEmpty()
    entityType: string;

    @ApiProperty({
        description: 'Batas tanggal penghapusan (Format YYYY-MM-DD). Data sebelum tanggal ini akan dihapus.',
        example: '2025-12-31',
    })
    @IsDateString({}, { message: 'Format tanggal harus YYYY-MM-DD (ISO 8601).' })
    @IsNotEmpty()
    cutoffDate: string;

    @ApiProperty({
        description: 'Security Token (HMAC) yang didapat dari dalam footer file hasil export (property: security.pruneToken). Token ini membuktikan bahwa data telah sukses diamankan.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.Et9LQ9...',
    })
    @IsString()
    @IsNotEmpty({
        message: 'SECURITY BLOCKED: Token Prune wajib disertakan. Anda harus melakukan export data terlebih dahulu dan menyalin token dari file hasil export.'
    })
    pruneToken: string;
}