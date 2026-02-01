import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateModuleDto } from './create-module.dto';

// Kita exclude 'sections' karena update section biasanya dilakukan secara terpisah
// atau memerlukan logika diffing yang spesifik, namun untuk CRUD sederhana
// Admin bisa mengupdate metadata module saja lewat sini.
export class UpdateModuleDto extends PartialType(
    OmitType(CreateModuleDto, ['sections'] as const),
) { }