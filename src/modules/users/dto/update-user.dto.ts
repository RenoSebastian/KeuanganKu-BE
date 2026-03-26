import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { formatToWhatsAppNumber } from '../../../common/utils/phone-formatter.util';

/**
 * [IMMUTABILITY ENFORCEMENT]
 * Menggunakan OmitType untuk memastikan atribut 'email' diamputasi dari skema Update.
 * Jika User mengirimkan payload { "email": "hacker@mail.com" }, ValidationPipe 
 * akan otomatis membuangnya (whitelist: true) atau menolaknya (forbidNonWhitelisted: true).
 */
export class UpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['email'] as const)
) {
    // =================================================================
    // SAAS ARCHITECTURE: AGENCY RELATIONSHIP
    // Mengubah string kosong "" (dari form frontend) menjadi null
    // agar Prisma mengeksekusi perintah 'disconnect' pada relasi.
    // =================================================================
    @ApiPropertyOptional({
        description: 'ID Agency (Kirim string kosong "" atau null untuk menghapus relasi)',
    })
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => (value === '' ? null : value))
    agencyId?: string;

    // =================================================================
    // PHASE 3: PHONE NUMBER INTEGRATION (GATEKEEPER)
    // =================================================================
    @ApiPropertyOptional({
        description: 'Nomor WhatsApp (Kirim string kosong "" untuk menghapus data)'
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }) => {
        // Jika frontend mengirim string kosong, konversi ke null agar database bersih
        if (value === '' || value === null) return null;

        // Jika ada isinya, lewatkan ke fungsi sanitizer murni kita
        return formatToWhatsAppNumber(value);
    })
    // Validasi akhir: Setelah disanitasi, nilainya harus HANYA berisi angka
    @Matches(/^[0-9]+$/, { message: 'Format nomor telepon tidak valid' })
    phoneNumber?: string;
}