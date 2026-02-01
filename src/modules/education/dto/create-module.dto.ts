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
    IsUrl,
} from 'class-validator';

// DTO untuk Detail Section (Atomic Content)
export class CreateSectionDto {
    @IsInt()
    @Min(1)
    sectionOrder: number;

    @IsString()
    @IsOptional()
    @MaxLength(150)
    title?: string;

    @IsString()
    @IsNotEmpty()
    contentMarkdown: string;

    @IsString()
    @IsOptional()
    @IsUrl({}, { message: 'Illustration URL must be a valid URL address' })
    illustrationUrl?: string;
}

// DTO untuk Header Module
export class CreateModuleDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @IsUUID()
    @IsNotEmpty()
    categoryId: string;

    @IsString()
    @IsNotEmpty()
    @IsUrl({}, { message: 'Thumbnail URL must be a valid URL address' })
    thumbnailUrl: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(300, { message: 'Excerpt is too long (max 300 chars)' })
    excerpt: string;

    @IsInt()
    @Min(1)
    readingTime: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSectionDto)
    sections: CreateSectionDto[];
}