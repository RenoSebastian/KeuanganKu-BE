import { PartialType } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';

/**
 * DTO untuk Update Modul
 * -----------------------------------------------------------
 * Menggunakan PartialType untuk mewarisi struktur CreateModuleDto
 * namun membuat semua field menjadi Optional (?).
 *
 * Rules:
 * 1. Jika field 'thumbnailUrl' dikirim, validasi Regex (uploads/) tetap berlaku.
 * 2. Jika field 'level' dikirim, validasi Enum tetap berlaku.
 * 3. Array 'sections' jika dikirim akan memvalidasi item di dalamnya
 * termasuk limitasi maksimal 4 gambar di 'mediaUrls' (Full Replacement Strategy).
 */
export class UpdateModuleDto extends PartialType(CreateModuleDto) { }