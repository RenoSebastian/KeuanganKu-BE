import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEnum,
    IsInt,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

// Enum untuk menjaga konsistensi tipe modul di database
export enum ModuleType {
    BUDGETING = 'BUDGETING',
    PENSION = 'PENSION',
    EDUCATION = 'EDUCATION',
    INSURANCE = 'INSURANCE',
    GOAL = 'GOAL',
    CHECKUP = 'CHECKUP',
}

export class SubmitTelemetryDto {
    @ApiProperty({
        enum: ModuleType,
        example: ModuleType.BUDGETING,
        description: 'Jenis modul simulasi yang dijalankan',
    })
    @IsEnum(ModuleType, { message: 'Tipe modul tidak valid (Gunakan: BUDGETING, PENSION, dll)' })
    moduleType: string;

    @ApiProperty({
        example: 'JOB-001',
        description: 'Kode Pekerjaan (KBJI Standard) untuk analisis sektor',
    })
    @IsString()
    occupationCode: string;

    @ApiProperty({
        example: 2,
        description: 'ID Range Pendapatan (Ref: Table ref_income_brackets)',
    })
    @IsInt()
    @Min(1)
    incomeBracketId: number;

    @ApiProperty({
        example: 85,
        description: 'Skor Kesehatan Finansial (0-100)',
    })
    @IsInt()
    @Min(0)
    @Max(100)
    financialScore: number;

    @ApiProperty({
        example: { savings_ratio: 20, debt_ratio: 10, surplus: 500000 },
        description: 'Metrik statistik (JSON). Data ini disimpan mentah untuk analitik Big Data.',
    })
    @IsObject()
    metrics: Record<string, any>;

    // --- Location Data (Optional) ---

    @ApiPropertyOptional({ example: -6.2088, description: 'Latitude lokasi simulasi' })
    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @ApiPropertyOptional({ example: 106.8456, description: 'Longitude lokasi simulasi' })
    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude?: number;
}