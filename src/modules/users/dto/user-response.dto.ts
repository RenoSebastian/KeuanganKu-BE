import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ComputedSubscriptionDto {
    @ApiProperty({ description: 'Sisa hari masa aktif langganan', example: 283 })
    remainingDays: number;

    @ApiProperty({ description: 'Flag boolean apakah langganan saat ini berstatus PRO', example: true })
    isActive: boolean;

    @ApiProperty({ description: 'Status turunan dinamis (ACTIVE, EXPIRED, INACTIVE)', example: 'ACTIVE' })
    derivedStatus: string;
}

export class ComputedUsageAnalyticsDto {
    @ApiProperty({ description: 'Flag boolean apakah user memiliki akses simulasi tanpa batas', example: true })
    isUnlimited: boolean;

    @ApiProperty({ description: 'Status metrik pemakaian (NORMAL, WARNING, CRITICAL, DEPLETED)', example: 'NORMAL' })
    healthStatus: string;

    @ApiProperty({ description: 'Total akumulasi penggunaan fitur (Analytics)', example: 450 })
    totalUsage: number;
}

export class ComputedMetricsDto {
    @ApiProperty({ type: () => ComputedSubscriptionDto })
    subscription: ComputedSubscriptionDto;

    @ApiProperty({ type: () => ComputedUsageAnalyticsDto })
    usageAnalytics: ComputedUsageAnalyticsDto;
}

export class UserResponseDto {
    @ApiProperty({ format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;

    @ApiProperty({ example: 'Budi Santoso' })
    fullName: string;

    @ApiProperty({ example: 'budi@example.com' })
    email: string;

    @ApiPropertyOptional({ example: '6281234567890' })
    phoneNumber?: string;

    @ApiProperty({ example: 'AGENT' })
    role: string;

    // ... Properti lain menyesuaikan skema Prisma (agencyId, dll)

    @ApiProperty({
        type: () => ComputedMetricsDto,
        description: 'Metrik kalkulasi in-memory (Countdown & FUP) yang ditambahkan oleh Backend'
    })
    computed: ComputedMetricsDto;
}