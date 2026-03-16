import { ApiProperty } from '@nestjs/swagger';

export class RevenueMetricsDto {
    @ApiProperty({ description: 'Total pendapatan kotor bulan ini', example: 15000000 })
    grossVolume: number;

    @ApiProperty({ description: 'Proyeksi pendapatan berulang bulanan (MRR)', example: 12000000 })
    mrr: number;

    @ApiProperty({ description: 'Total nominal dari pembayaran yang masih menunggu verifikasi', example: 500000 })
    pendingValue: number;
}

export class UserMetricsDto {
    @ApiProperty({ description: 'Total pengguna terdaftar', example: 1250 })
    totalUsers: number;

    @ApiProperty({ description: 'Daily Active Users (Pengguna aktif harian)', example: 150 })
    dau: number;

    @ApiProperty({ description: 'Monthly Active Users (Pengguna aktif bulanan)', example: 800 })
    mau: number;

    @ApiProperty({ description: 'Persentase konversi pengguna gratis ke berbayar', example: 12.5 })
    conversionRate: number;
}

export class FeatureUsageDto {
    @ApiProperty({ description: 'Nama modul/kalkulator', example: 'budgeting' })
    featureName: string;

    @ApiProperty({ description: 'Jumlah penggunaan dalam periode tertentu', example: 450 })
    usageCount: number;

    @ApiProperty({ description: 'Persentase penggunaan dibandingkan fitur lain', example: 35.5 })
    percentage: number;
}

export class SystemUsageMetricsDto {
    @ApiProperty({ type: [FeatureUsageDto], description: 'Distribusi penggunaan fitur kalkulator' })
    featureDistribution: FeatureUsageDto[];

    @ApiProperty({ description: 'Rata-rata penggunaan kuota oleh pengguna gratis', example: 4.2 })
    averageFreeQuotaConsumption: number;
}

export class DashboardMetricsResponseDto {
    @ApiProperty({ type: RevenueMetricsDto, description: 'Metrik terkait pendapatan dan kas' })
    revenue: RevenueMetricsDto;

    @ApiProperty({ type: UserMetricsDto, description: 'Metrik terkait aktivitas dan retensi pengguna' })
    users: UserMetricsDto;

    @ApiProperty({ type: SystemUsageMetricsDto, description: 'Metrik terkait utilitas sistem' })
    systemUsage: SystemUsageMetricsDto;

    @ApiProperty({ description: 'Waktu terakhir data ini di-generate/di-cache', example: '2026-03-16T08:59:00Z' })
    lastUpdatedAt: Date;
}