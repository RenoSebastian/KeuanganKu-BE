import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateVoucherDto {
    @ApiProperty({ description: 'Kode unik voucher (uppercase)', example: 'ENGINE50' })
    @IsNotEmpty()
    @IsString()
    code: string;

    @ApiProperty({ description: 'Nama atau deskripsi promo', example: 'Diskon Spesial 50% Komunitas Engine' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ enum: DiscountType, description: 'Tipe diskon: PERCENTAGE atau FIXED_AMOUNT' })
    @IsNotEmpty()
    @IsEnum(DiscountType)
    discountType: DiscountType;

    @ApiProperty({ description: 'Nilai diskon (Persen atau Nominal Rupiah)', example: 50 })
    @IsNotEmpty()
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    discountValue: number;

    @ApiProperty({ description: 'Batas maksimal potongan rupiah (opsional untuk persentase)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    maxDiscountAmount?: number;

    @ApiProperty({ description: 'Minimal nominal pembelian (opsional)', required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPurchaseAmount?: number;

    @ApiProperty({ description: 'Status aktif voucher', default: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}
