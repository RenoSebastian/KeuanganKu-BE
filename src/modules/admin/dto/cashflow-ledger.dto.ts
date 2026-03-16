import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enum ini sebaiknya disinkronkan dengan schema Prisma Anda (SubscriptionStatus)
export enum CashflowStatus {
    VERIFIED = 'VERIFIED',
    PENDING = 'PENDING',
    REJECTED = 'REJECTED',
}

export class CashflowLedgerItemDto {
    @ApiProperty({ description: 'ID Transaksi / Subscription', example: 'sub_12345abcde' })
    transactionId: string;

    @ApiProperty({ description: 'Tanggal transaksi atau tanggal verifikasi', example: '2026-03-15T14:30:00Z' })
    transactionDate: Date;

    @ApiProperty({ description: 'Nama paket yang dilanggan', example: 'Maxi Pro Annual' })
    planName: string;

    @ApiProperty({ description: 'Nominal pembayaran', example: 1500000 })
    amount: number;

    @ApiProperty({ enum: CashflowStatus, description: 'Status pembayaran' })
    status: CashflowStatus;

    @ApiPropertyOptional({ description: 'Nama Admin yang melakukan verifikasi', example: 'SuperAdmin 1' })
    verifiedBy?: string;

    @ApiProperty({ description: 'Nama User yang melakukan pembayaran', example: 'John Doe' })
    userName: string;
}

export class PaginationMetaDto {
    @ApiProperty({ description: 'Total keseluruhan data', example: 250 })
    total: number;

    @ApiProperty({ description: 'Halaman saat ini', example: 1 })
    page: number;

    @ApiProperty({ description: 'Limit data per halaman', example: 10 })
    limit: number;

    @ApiProperty({ description: 'Total halaman yang tersedia', example: 25 })
    totalPages: number;
}

export class CashflowLedgerResponseDto {
    @ApiProperty({ type: [CashflowLedgerItemDto], description: 'Daftar transaksi kas masuk' })
    data: CashflowLedgerItemDto[];

    @ApiProperty({ type: PaginationMetaDto, description: 'Metadata untuk keperluan paginasi tabel' })
    meta: PaginationMetaDto;
}