import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
    ArrayMinSize,
    ArrayMaxSize,
    Max,
    Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizQuestionType } from '@prisma/client';

/**
 * [SECURITY CONSTANT]
 * Regex Validator untuk Path Gambar.
 * Rules:
 * 1. Optional leading slash (/)
 * 2. Wajib diawali folder 'uploads/'
 * 3. Filename hanya boleh alphanumeric, underscore, dan dash (UUID safe)
 * 4. Ekstensi wajib gambar (jpg, jpeg, png, webp)
 */
const IMAGE_PATH_REGEX = /^(?:\/)?uploads\/[\w-]+\.(jpg|jpeg|png|webp)$/i;
const IMAGE_VALIDATION_MSG = 'Image URL must be a valid path (e.g. uploads/uuid.jpg) and explicitly an image file.';

// --- 1. DTO OPSI JAWABAN ---

export class UpsertQuizOptionDto {
    @ApiProperty({
        description: 'Teks jawaban yang ditampilkan ke user.',
        example: 'Aset Lancar'
    })
    @IsString()
    @IsNotEmpty()
    optionText: string;

    @ApiProperty({
        description: 'Menentukan apakah ini jawaban yang benar.',
        example: true
    })
    @IsBoolean()
    @IsNotEmpty()
    isCorrect: boolean;

    @ApiPropertyOptional({
        description: 'URL Gambar pendukung untuk opsi jawaban (Opsional).',
        example: 'uploads/550e8400-e29b-41d4-a716-446655440000.jpg'
    })
    @IsString()
    @IsOptional()
    @Matches(IMAGE_PATH_REGEX, { message: IMAGE_VALIDATION_MSG })
    imageUrl?: string;

    @ApiPropertyOptional({
        description: 'Urutan tampilan opsi (jika ingin custom order).',
        example: 1
    })
    @IsInt()
    @IsOptional()
    orderIndex?: number;
}

// --- 2. DTO PERTANYAAN ---

export class UpsertQuizQuestionDto {
    @ApiProperty({
        description: 'Teks pertanyaan utama.',
        example: 'Apa yang dimaksud dengan aset likuid?'
    })
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @ApiProperty({
        enum: QuizQuestionType,
        description: 'Tipe pertanyaan (Pilihan Ganda / True-False, dll).',
        example: 'MULTIPLE_CHOICE'
    })
    @IsEnum(QuizQuestionType)
    type: QuizQuestionType;

    @ApiProperty({
        description: 'Urutan pertanyaan dalam kuis.',
        example: 1
    })
    @IsInt()
    @Min(1)
    orderIndex: number;

    @ApiPropertyOptional({
        description: 'Gambar ilustrasi untuk soal (Opsional).',
        example: 'uploads/a1b2c3d4-e5f6-7890-1234-56789abcdef0.png'
    })
    @IsString()
    @IsOptional()
    @Matches(IMAGE_PATH_REGEX, { message: IMAGE_VALIDATION_MSG })
    imageUrl?: string;

    @ApiPropertyOptional({
        description: 'Penjelasan/Pembahasan yang muncul setelah kuis selesai.',
        example: 'Aset likuid adalah aset yang mudah dicairkan...'
    })
    @IsString()
    @IsOptional()
    explanation?: string;

    @ApiPropertyOptional({
        description: 'Bobot nilai untuk pertanyaan ini (Default: 10).',
        example: 10
    })
    @IsInt()
    @Min(1)
    @IsOptional()
    points?: number;

    @ApiProperty({
        type: [UpsertQuizOptionDto],
        description: 'Daftar pilihan jawaban (Minimal 2, Maksimal 5).'
    })
    @IsArray()
    @ArrayMinSize(2, { message: 'Sebuah pertanyaan minimal harus memiliki 2 opsi (misal: Benar/Salah).' })
    @ArrayMaxSize(5, { message: 'Sebuah pertanyaan maksimal hanya diperbolehkan memiliki 5 opsi.' })
    @ValidateNested({ each: true })
    @Type(() => UpsertQuizOptionDto)
    options: UpsertQuizOptionDto[];
}

// --- 3. DTO UTAMA (QUIZ HEADER) ---

export class UpsertQuizDto {
    @ApiProperty({
        description: 'Nilai minimal untuk lulus (Passing Grade).',
        example: 70,
        minimum: 0,
        maximum: 100
    })
    @IsInt()
    @Min(0)
    @Max(100)
    passingScore: number;

    @ApiProperty({
        description: 'Batas waktu pengerjaan dalam menit. 0 berarti tanpa batas waktu.',
        example: 30,
        minimum: 0
    })
    @IsInt()
    @Min(0)
    timeLimit: number;

    @ApiProperty({
        description: 'Jumlah maksimal user boleh mencoba kuis ini.',
        example: 3,
        minimum: 1
    })
    @IsInt()
    @Min(1)
    maxAttempts: number;

    @ApiPropertyOptional({
        description: 'Deskripsi singkat atau instruksi kuis.',
        example: 'Kuis ini menguji pemahaman dasar akuntansi Anda.'
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({
        type: [UpsertQuizQuestionDto],
        description: 'Array berisi seluruh pertanyaan dan jawaban untuk kuis ini (Minimal 5, Maksimal 10).'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpsertQuizQuestionDto)
    @ArrayMinSize(5, { message: 'Kuis tidak valid: Minimal harus memuat 5 soal.' })
    @ArrayMaxSize(10, { message: 'Kuis tidak valid: Maksimal hanya diperbolehkan 10 soal.' })
    questions: UpsertQuizQuestionDto[];
}