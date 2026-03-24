import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    MinLength,
    Matches
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { formatToWhatsAppNumber } from '../../../common/utils/phone-formatter.util';

export class AdminUpdateUserDto extends PartialType(CreateUserDto) {
    // =================================================================
    // OVERRIDE PRIVILEGES
    // =================================================================

    @ApiPropertyOptional({ enum: Role, description: 'Role akses sistem' })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiPropertyOptional({
        example: 'NewPassword123!',
        description: 'Password baru (Biarkan kosong jika tidak ingin mereset password user)',
    })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

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