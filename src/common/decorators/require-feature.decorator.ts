import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { FinancialFeature } from '../constants/tier-features.constant';
import { SubscriptionGuard } from '../guards/subscription.guard';

export const REQUIRED_FEATURE_KEY = 'required_financial_feature';

/**
 * Dekorator deklaratif untuk memproteksi endpoint berdasarkan Feature-Gated Tiering.
 * Contoh: @RequireFeature(FinancialFeature.EDUCATION)
 */
export function RequireFeature(feature: FinancialFeature) {
    return applyDecorators(
        SetMetadata(REQUIRED_FEATURE_KEY, feature),
        UseGuards(SubscriptionGuard),
    );
}
