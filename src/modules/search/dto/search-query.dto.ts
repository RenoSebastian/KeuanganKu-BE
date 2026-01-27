import { IsString, IsOptional, IsInt, Min, MinLength, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchQueryDto {
    @IsString()
    @MinLength(2, { message: 'Kata kunci minimal 2 karakter agar pencarian akurat' })
    @Transform(({ value }) => value?.trim()) // Sanitasi: Hapus spasi berlebih
    q: string;

    @IsOptional()
    @IsString()
    @IsIn(['USER', 'UNIT'], { message: 'Filter tipe hanya boleh USER atau UNIT' })
    type?: 'USER' | 'UNIT'; // Opsional: Untuk filter spesifik

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;
}