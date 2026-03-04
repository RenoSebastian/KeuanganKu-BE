import { SubscriptionStatus } from '@prisma/client';
import { Expose, Type } from 'class-transformer';

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
}

export class UserSubscriptionDto {
    @Expose()
    id: string;

    @Expose()
    status: SubscriptionStatus;

    @Expose()
    startDate: Date;

    @Expose()
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
    createdAt: Date;

    @Expose()
    proofImageUrl: string;
}