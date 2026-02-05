import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    IsUrl,
    MaxLength,
    Min,
} from 'class-validator';

/**
 * UpdateProfileDto
 * Digunakan oleh Agen untuk melengkapi data diri mereka secara bertahap.
 * Semua field bersifat OPTIONAL.
 */
export class UpdateProfileDto {
    @ApiPropertyOptional({ example: 'PT Asuransi Jiwa', description: 'Nama perusahaan/instansi' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    company?: string;

    @ApiPropertyOptional({ example: 'Senior Agent', description: 'Jabatan pekerjaan saat ini' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    jabatan?: string;

    @ApiPropertyOptional({ example: '081234567890', description: 'Nomor WhatsApp aktif' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    // Transformasi: Hapus spasi/dash agar format seragam di DB
    @Transform(({ value }) => value?.replace(/[^0-9+]/g, ''))
    noWa?: string;

    @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1, Jakarta', description: 'Alamat domisili lengkap' })
    @IsOptional()
    @IsString()
    alamatDomisili?: string;

    @ApiPropertyOptional({ example: '1990-01-01', description: 'Tanggal lahir (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    tanggalLahir?: string;

    @ApiPropertyOptional({ example: 'LAKI_LAKI', description: 'Jenis Kelamin (LAKI_LAKI / PEREMPUAN)' })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ example: 'MENIKAH', description: 'Status pernikahan' })
    @IsOptional()
    @IsString()
    statusMenikah?: string;

    @ApiPropertyOptional({ example: 2, description: 'Jumlah tanggungan (anak/istri)' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Transform(({ value }) => parseInt(value)) // Pastikan angka
    jumlahTanggungan?: number;

    @ApiPropertyOptional({ example: 'https://storage.com/avatar.jpg', description: 'URL Foto Profil' })
    @IsOptional()
    @IsString()
    profilPicture?: string;
}