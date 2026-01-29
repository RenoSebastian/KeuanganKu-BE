import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUnitDto {
    @ApiProperty({ example: 'IT-DEV', description: 'Kode unik unit kerja' })
    @IsString()
    @IsNotEmpty()
    kodeUnit: string;

    @ApiProperty({ example: 'Divisi Pengembangan TI', description: 'Nama unit kerja' })
    @IsString()
    @IsNotEmpty()
    namaUnit: string;
}