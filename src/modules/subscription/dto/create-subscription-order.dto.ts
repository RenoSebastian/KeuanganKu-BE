import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionOrderDto {
    @ApiProperty({
        description: 'ID dari Plan yang dipilih (UUID)',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsNotEmpty()
    @IsUUID('4', { message: 'Plan ID harus berupa UUID yang valid' })
    planId: string;

    @ApiProperty({
        type: 'string',
        format: 'binary',
        description: 'Bukti transfer (Gambar/PDF)',
    })
    proofFile: any; // Property ini hanya untuk dokumentasi Swagger, validasi real ada di FileInterceptor
}