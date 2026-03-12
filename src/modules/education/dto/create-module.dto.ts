import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
    MaxLength,
    Matches,
    IsEnum,
    ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EducationLevel } from '@prisma/client';

/**
 * DTO untuk Detail Section (Atomic Content)
 * Digunakan di dalam array sections pada CreateModuleDto
 */
export class CreateSectionDto {
    @ApiProperty({ description: 'Urutan section/halaman', example: 1 })
    @IsInt()
    @Min(1)
    sectionOrder: number;

    @ApiPropertyOptional({ description: 'Judul sub-bab/halaman', example: 'Pengenalan Budgeting' })
    @IsString()
    @IsOptional()
    @MaxLength(150)
    title?: string;

    @ApiProperty({ description: 'Konten materi dalam format Markdown', example: '# Judul \n Isi materi...' })
    @IsString()
    @IsNotEmpty()
    contentMarkdown: string;

    // [MODIFIED] Mengganti single string menjadi array of strings untuk carousel
    @ApiPropertyOptional({
        description: 'Daftar path gambar materi (Maksimal 4 gambar untuk carousel)',
        example: ['uploads/img1.jpg', 'uploads/img2.png'],
        type: [String]
    })
    @IsArray()
    @IsOptional()
    @ArrayMaxSize(4, { message: 'Maksimal 4 gambar yang diperbolehkan dalam 1 halaman materi' })
    @IsString({ each: true, message: 'Setiap URL gambar harus berupa teks string' })
    @Matches(/^(?:\/)?uploads\/[\w-]+\.(jpg|jpeg|png|svg|webp)$/i, {
        each: true,
        message: 'Setiap URL harus berupa path valid yang diawali dengan "uploads/" dan memiliki ekstensi gambar yang didukung'
    })
    imageUrls?: string[]; // <-- UBAH DARI mediaUrls MENJADI imageUrls
}

/**
 * DTO Utama untuk Pembuatan Modul
 */
export class CreateModuleDto {
    @ApiProperty({ description: 'Judul Modul Pembelajaran', example: 'Dasar Perencanaan Keuangan' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @ApiProperty({ description: 'ID Kategori (UUID)', example: '123e4567-e89b-12d3-a456-426614174000' })
    @IsUUID()
    @IsNotEmpty()
    categoryId: string;

    @ApiProperty({ description: 'Cover Image Path (Relative)', example: 'uploads/cover-image.jpg' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^(?:\/)?uploads\/[\w-]+\.(jpg|jpeg|png|svg|webp)$/i, {
        message: 'Thumbnail URL must be a valid relative path starting with "uploads/" and supported image extension'
    })
    thumbnailUrl: string;

    @ApiProperty({ description: 'Ringkasan singkat modul', example: 'Belajar cara mengatur gaji...' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(300, { message: 'Excerpt is too long (max 300 chars)' })
    excerpt: string;

    @ApiProperty({ description: 'Tingkat kesulitan modul', enum: EducationLevel, example: 'BEGINNER' })
    @IsEnum(EducationLevel)
    @IsNotEmpty()
    level: EducationLevel;

    @ApiProperty({ description: 'Estimasi waktu baca dalam menit', example: 5 })
    @IsInt()
    @Min(1)
    readingTime: number;

    @ApiProperty({ description: 'Poin reward saat menyelesaikan modul', example: 100, default: 0 })
    @IsInt()
    @Min(0)
    @IsOptional()
    points?: number;

    @ApiProperty({ type: [CreateSectionDto], description: 'Daftar halaman/section materi' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSectionDto)
    sections: CreateSectionDto[];
}