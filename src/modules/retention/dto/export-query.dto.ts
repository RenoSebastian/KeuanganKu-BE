import { IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Enum harus sinkron dengan Strategy Factory
export enum RetentionEntityType {
    FINANCIAL_CHECKUP = 'FINANCIAL_CHECKUP',
    PENSION = 'PENSION',
    GOAL = 'GOAL',
    BUDGET = 'BUDGET',
    INSURANCE = 'INSURANCE',
}

export class ExportQueryDto {
    @ApiProperty({
        enum: RetentionEntityType,
        description: 'Tipe entitas data yang akan diexport',
        example: 'FINANCIAL_CHECKUP',
    })
    @IsEnum(RetentionEntityType, {
        message: 'Entity Type tidak valid. Gunakan: FINANCIAL_CHECKUP, PENSION, GOAL, BUDGET, atau INSURANCE.',
    })
    @IsNotEmpty()
    entityType: string;

    @ApiProperty({
        description: 'Tanggal batas data (cutoff). Data sebelum tanggal ini akan ditarik.',
        example: '2025-01-01',
    })
    @IsDateString({}, { message: 'Cutoff Date harus format ISO 8601 (YYYY-MM-DD)' })
    @IsNotEmpty()
    cutoffDate: string;
}