import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
    MinLength,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class AdminUpdateUserDto extends PartialType(CreateUserDto) {
    // Override untuk memastikan Admin bisa mengubah Role user
    @ApiPropertyOptional({ enum: Role, description: 'Role akses sistem' })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    // Handle password change (Opsional: hanya jika admin ingin mereset password user)
    @ApiPropertyOptional({
        example: 'NewPassword123!',
        description: 'Password baru (Biarkan kosong jika tidak ingin mengubah)',
    })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    // Transformasi khusus untuk Agency ID:
    // Mengubah string kosong "" (dari form frontend) menjadi null (untuk disconnect agency di DB)
    // atau undefined (untuk ignore). Di sini kita set null agar bisa "melepas" agen dari agency.
    @ApiPropertyOptional({
        description: 'ID Agency baru (Kirim null/kosong untuk menghapus relasi)',
    })
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => (value === '' ? null : value))
    agencyId?: string;

    // [LEGACY COMPATIBILITY]
    // Jika frontend masih mengirim 'unitKerjaId', kita mapping ke 'agencyId'
    // atau biarkan validator menolaknya jika strict.
    // Disarankan menghapus field ini jika FE sudah refactor.
    @IsOptional()
    @IsUUID()
    @Transform(({ value }) => (value === '' ? null : value))
    unitKerjaId?: string;
}