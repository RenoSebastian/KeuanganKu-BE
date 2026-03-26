import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    Matches
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { formatToWhatsAppNumber } from '../../../common/utils/phone-formatter.util';

/**
 * [SECURITY ENFORCEMENT: ZERO-KNOWLEDGE PRINCIPLE]
 * Mengamputasi atribut 'email' (Immutabilitas) dan 'password' (Information Expert)
 * dari pewarisan CreateUserDto. Admin tidak boleh bisa mengganti sandi pengguna secara manual.
 */
export class AdminUpdateUserDto extends PartialType(
    OmitType(CreateUserDto, ['email', 'password'] as const)
) {
    // =================================================================
    // OVERRIDE PRIVILEGES
    // =================================================================

    @ApiPropertyOptional({ enum: Role, description: 'Role akses sistem' })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    // [DELETED] Atribut 'password' telah dihapus secara permanen dari kelas ini.
    // Reset sandi harus melalui alur /trigger-reset (OTP Email) demi Non-Repudiation.

    // Transformasi khusus untuk Agency ID:
    @ApiPropertyOptional({
        description: 'ID Agency baru (Kirim string kosong "" atau null untuk menghapus relasi)',
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
        // Jika admin mengosongkan input nomor HP, konversi ke null
        if (value === '' || value === null) return null;

        // Lewatkan ke fungsi sanitizer agar otomatis berformat 62...
        return formatToWhatsAppNumber(value);
    })
    @Matches(/^[0-9]+$/, { message: 'Format nomor telepon tidak valid' })
    phoneNumber?: string;
}