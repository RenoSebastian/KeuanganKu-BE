import { SubscriptionStatus } from '@prisma/client';
import { Expose, Type, Transform } from 'class-transformer';

export class SubscriptionPlanDto {
    @Expose()
    id: string;

    @Expose()
    name: string;

    @Expose()
    code: string;

    @Expose()
    durationMonths: number;

    @Expose()
    price: number;

    // [NEW] Diekspos ke frontend untuk kebutuhan UI harga coret
    @Expose()
    originalPrice?: number;

    // [NEW] Diekspos ke frontend untuk kebutuhan label marketing (misal: "Hemat 150.000")
    @Expose()
    discountNote?: string;
}

export class UserSubscriptionDto {
    @Expose()
    id: string;

    @Expose()
    status: SubscriptionStatus;

    @Expose()
    // [FIX] Memaksa konversi ke ISO 8601 agar tidak diserialisasi menjadi {}
    @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
    startDate: Date;

    @Expose()
    // [FIX] Memaksa konversi ke ISO 8601 agar tidak diserialisasi menjadi {}
    @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
    endDate: Date;

    @Expose()
    @Type(() => SubscriptionPlanDto)
    plan: SubscriptionPlanDto;

    @Expose()
    daysRemaining?: number; // Computed field untuk kemudahan FE
}

export class SubscriptionOrderResponseDto {
    @Expose()
    id: string;

    @Expose()
    verificationStatus: string;

    @Expose()
    // [FIX] Memaksa konversi ke ISO 8601 agar tidak diserialisasi menjadi {}
    @Transform(({ value }) => value instanceof Date ? value.toISOString() : value)
    createdAt: Date;

    @Expose()
    proofImageUrl: string;
}