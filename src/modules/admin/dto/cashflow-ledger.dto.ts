import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export enum CashflowStatus {
    VERIFIED = 'VERIFIED',
    PENDING = 'PENDING',
    REJECTED = 'REJECTED'
}

export class CashflowLedgerItemDto {
    @ApiProperty()
    @Expose()
    transactionId: string;

    @ApiProperty()
    @Expose()
    // [FIX MUTLAK] Mencegah Date menjadi {} dengan memaksanya menjadi ISO String
    @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
    transactionDate: Date;

    @ApiProperty()
    @Expose()
    planName: string;

    @ApiProperty()
    @Expose()
    amount: number;

    @ApiProperty({ enum: CashflowStatus })
    @Expose()
    status: CashflowStatus;

    @ApiProperty({ required: false })
    @Expose()
    verifiedBy?: string;

    @ApiProperty()
    @Expose()
    userName: string;
}

export class CashflowLedgerResponseDto {
    @ApiProperty({ type: [CashflowLedgerItemDto] })
    @Expose()
    @Type(() => CashflowLedgerItemDto)
    data: CashflowLedgerItemDto[];

    @ApiProperty()
    @Expose()
    meta: any;
}