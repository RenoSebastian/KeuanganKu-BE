import { IsEnum, IsDateString, IsNotEmpty, IsBoolean, Equals } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RetentionEntityType } from './export-query.dto'; // Reuse Enum dari Fase 3

export class PruneExecutionDto {
    @ApiProperty({
        enum: RetentionEntityType,
        description: 'Target data yang akan dimusnahkan',
        example: 'FINANCIAL_CHECKUP',
    })
    @IsEnum(RetentionEntityType)
    @IsNotEmpty()
    entityType: string;

    @ApiProperty({
        description: 'Batas tanggal penghapusan. HARUS < Awal Bulan Ini.',
        example: '2025-12-31',
    })
    @IsDateString()
    @IsNotEmpty()
    cutoffDate: string;

    @ApiProperty({
        description: 'Safety Toggle: Konfirmasi bahwa Admin SUDAH melakukan export data.',
        example: true,
    })
    @IsBoolean()
    @Equals(true, { message: 'Anda WAJIB mengonfirmasi bahwa data telah diexport sebelum menghapus.' })
    confirmExported: boolean;
}