import { IsEnum, IsNotEmpty } from 'class-validator';
import { EducationModuleStatus } from '@prisma/client';

export class UpdateModuleStatusDto {
    @IsEnum(EducationModuleStatus)
    @IsNotEmpty()
    status: EducationModuleStatus;
}