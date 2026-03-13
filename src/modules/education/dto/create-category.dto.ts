import { IsNotEmpty, IsString, MaxLength, IsOptional, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
    @ApiProperty({
        description: 'Nama kategori yang unik.',
        example: 'Investasi Saham',
        minLength: 3,
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(50)
    @Transform(({ value }) => value?.trim())
    name: string;

    @ApiPropertyOptional({
        description: 'Deskripsi singkat kategori.',
        example: 'Panduan lengkap mengenai analisis saham.',
    })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    @Transform(({ value }) => value?.trim())
    description?: string;

    @ApiProperty({
        description: 'URL/Path icon kategori (dari Media Upload).',
        example: '/media/icon-saham.png',
    })
    @IsString({ message: 'Icon URL harus berupa string path.' })
    @IsNotEmpty({ message: 'Icon URL wajib diisi.' })
    // [FIX] Mengubah boundary validasi awalan dari 'uploads/' menjadi 'media/' 
    // agar sinkron dengan output frontend yang baru.
    @Matches(/^(?:\/)?media\/[\w-]+\.(jpg|jpeg|png|svg|webp)$/i, {
        message: 'Icon URL harus valid (e.g. /media/file.png) dan berupa file gambar yang didukung.',
    })
    iconUrl: string;
}