import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMarketSettingsDto {
    @IsOptional()
    @IsNumber({}, { message: 'Inflasi harus berupa angka' })
    @Min(0, { message: 'Inflasi tidak boleh negatif' })
    @Max(100, { message: 'Inflasi tidak boleh lebih dari 100%' })
    @Type(() => Number)
    inflationRate?: number;

    @IsOptional()
    @IsNumber({}, { message: 'Suku bunga harus berupa angka' })
    @Min(0, { message: 'Suku bunga tidak boleh negatif' })
    @Max(50, { message: 'Suku bunga tidak wajar (> 50%)' }) // Batas wajar ekonomi
    @Type(() => Number)
    interestRate?: number;

    @IsOptional()
    @IsNumber({}, { message: 'Risk Free Rate harus berupa angka' })
    @Min(0, { message: 'Risk Free Rate tidak boleh negatif' })
    @Max(50, { message: 'Risk Free Rate tidak wajar (> 50%)' })
    @Type(() => Number)
    riskFreeRate?: number;

    @IsOptional()
    @IsNumber({}, { message: 'Harga emas harus berupa angka' })
    @Min(1, { message: 'Harga emas harus positif' })
    @Type(() => Number)
    goldPrice?: number;
}