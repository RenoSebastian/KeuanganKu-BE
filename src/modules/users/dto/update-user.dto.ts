import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches, IsDateString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { formatToWhatsAppNumber } from '../../../common/utils/phone-formatter.util';

/**
 * [REFACTORED] UpdateProfileDto
 * Bertindak sebagai Single Source of Truth untuk update profil Agen.
 * Telah dibersihkan dari atribut non-esensial (gender, address, tanggungan).
 */
export class UpdateProfileDto {
    @ApiPropertyOptional({ description: 'Nama Lengkap & Gelar Agen' })
    @IsOptional()
    @IsString()
    fullName?: string;

    @ApiPropertyOptional({ description: 'Nomor WhatsApp tersanitasi' })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => {
        if (value === '' || value === null) return null;
        return formatToWhatsAppNumber(value);
    })
    @Matches(/^[0-9]+$/, { message: 'Format nomor telepon tidak valid' })
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Level Jabatan Agen (e.g., Senior Agent)' })
    @IsOptional()
    @IsString()
    agentLevel?: string;

    @ApiPropertyOptional({ description: 'Nama Perusahaan Asuransi Induk' })
    @IsOptional()
    @IsString()
    companyName?: string;

    @ApiPropertyOptional({ description: 'Nama Kantor Agency (Jika input manual)' })
    @IsOptional()
    @IsString()
    agencyName?: string;

    @ApiPropertyOptional({ description: 'ID Agency untuk Relasi (Jika menggunakan dropdown Master Data)' })
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => (value === '' ? null : value))
    agencyId?: string;

    @ApiPropertyOptional({ description: 'Tanggal Lahir (Format ISO/String Date)' })
    @IsOptional()
    // @IsDateString() // Buka komentar ini jika Frontend dijamin mengirimkan ISO 8601 yang valid
    @IsString()
    dateOfBirth?: string;

    @ApiPropertyOptional({ description: 'Visi atau Target Profesional Agen' })
    @IsOptional()
    @IsString()
    goals?: string;

    @ApiPropertyOptional({ description: 'Foto Profil dalam format Base64' })
    @IsOptional()
    @IsString()
    avatar?: string;
}