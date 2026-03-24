import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { formatToWhatsAppNumber } from '../../../common/utils/phone-formatter.util';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    // Override untuk menangani kasus string kosong "" dari frontend
    // Jika frontend mengirim "", ubah jadi undefined agar tidak diproses oleh Prisma
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => (value === '' ? undefined : value))
    unitKerjaId?: string;

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