// File: src/modules/admin/dto/user-analytics-query.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsDateString } from 'class-validator';

export enum AnalyticsResolution {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}

export class UserAnalyticsQueryDto {
    @ApiProperty({
        description: 'Tanggal awal dari rentang waktu analitik (Format ISO 8601: YYYY-MM-DD)',
        example: '2026-01-01',
        required: true,
    })
    @IsNotEmpty({ message: 'Parameter startDate tidak boleh kosong' })
    @IsDateString({}, { message: 'Parameter startDate harus berupa format tanggal ISO 8601 yang valid' })
    startDate: string;

    @ApiProperty({
        description: 'Tanggal akhir dari rentang waktu analitik (Format ISO 8601: YYYY-MM-DD)',
        example: '2026-12-31',
        required: true,
    })
    @IsNotEmpty({ message: 'Parameter endDate tidak boleh kosong' })
    @IsDateString({}, { message: 'Parameter endDate harus berupa format tanggal ISO 8601 yang valid' })
    endDate: string;

    @ApiProperty({
        description: 'Resolusi atau jarak interval poin data pada grafik (harian, mingguan, bulanan)',
        enum: AnalyticsResolution,
        example: AnalyticsResolution.MONTHLY,
        required: true,
    })
    @IsNotEmpty({ message: 'Parameter resolution tidak boleh kosong' })
    @IsEnum(AnalyticsResolution, {
        message: 'Resolusi tidak valid. Pilihan yang diizinkan hanya: daily, weekly, atau monthly'
    })
    resolution: AnalyticsResolution;
}