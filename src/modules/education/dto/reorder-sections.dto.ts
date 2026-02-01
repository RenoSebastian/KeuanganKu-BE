import { IsInt, IsNotEmpty, IsUUID, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class SectionOrderItem {
    @IsUUID()
    @IsNotEmpty()
    sectionId: string;

    @IsInt()
    @Min(1)
    newOrder: number;
}

export class ReorderSectionsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SectionOrderItem)
    items: SectionOrderItem[];
}