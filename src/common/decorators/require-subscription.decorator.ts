import { applyDecorators, UseGuards } from '@nestjs/common';
import { SubscriptionGuard } from '../guards/subscription.guard';
import { ApiForbiddenResponse } from '@nestjs/swagger';

export function RequireSubscription() {
    return applyDecorators(
        UseGuards(SubscriptionGuard),
        ApiForbiddenResponse({
            description: 'Akses ditolak: Memerlukan langganan aktif (Premium/Trial).',
        }),
    );
}