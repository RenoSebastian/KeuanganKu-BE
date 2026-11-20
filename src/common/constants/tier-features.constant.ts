import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

/**
 * Single Source of Truth untuk seluruh fitur kalkulator finansial KeuanganKu.
 */
export enum FinancialFeature {
    BUDGETING = 'BUDGETING',
    RISK_PROFILE = 'RISK_PROFILE',
    CHECKUP = 'CHECKUP',
    PENSION = 'PENSION',
    GOALS = 'GOALS',
    EDUCATION = 'EDUCATION',
    INSURANCE = 'INSURANCE',
}

export const TIER_RANK: Record<SubscriptionTier, number> = {
    [SubscriptionTier.BRONZE]: 0,
    [SubscriptionTier.SILVER]: 1,
    [SubscriptionTier.GOLD]: 2,
};

export const TIER_DISPLAY_NAME: Record<SubscriptionTier, string> = {
    [SubscriptionTier.BRONZE]: 'Bronze',
    [SubscriptionTier.SILVER]: 'Silver',
    [SubscriptionTier.GOLD]: 'Gold',
};

/**
 * Matriks resmi pembatasan fitur per Tier (Unlimited penggunaan untuk fitur yang terbuka).
 */
export const TIER_FEATURES_MAP: Record<SubscriptionTier, FinancialFeature[]> = {
    [SubscriptionTier.BRONZE]: [
        FinancialFeature.BUDGETING,
        FinancialFeature.RISK_PROFILE,
    ],
    [SubscriptionTier.SILVER]: [
        FinancialFeature.BUDGETING,
        FinancialFeature.RISK_PROFILE,
        FinancialFeature.CHECKUP,
        FinancialFeature.PENSION,
        FinancialFeature.GOALS,
    ],
    [SubscriptionTier.GOLD]: [
        FinancialFeature.BUDGETING,
        FinancialFeature.RISK_PROFILE,
        FinancialFeature.CHECKUP,
        FinancialFeature.PENSION,
        FinancialFeature.GOALS,
        FinancialFeature.EDUCATION,
        FinancialFeature.INSURANCE,
    ],
};

export const FEATURE_DISPLAY_NAME: Record<FinancialFeature, string> = {
    [FinancialFeature.BUDGETING]: 'Rancang Anggaran',
    [FinancialFeature.RISK_PROFILE]: 'Risk Profile',
    [FinancialFeature.CHECKUP]: 'Financial Health Check-up',
    [FinancialFeature.PENSION]: 'Rancang Pensiun',
    [FinancialFeature.GOALS]: 'Rancang Dana Tujuan Khusus',
    [FinancialFeature.EDUCATION]: 'Rancang Pendidikan',
    [FinancialFeature.INSURANCE]: 'Rancang Proteksi',
};

export const FEATURE_MIN_TIER: Record<FinancialFeature, SubscriptionTier> = {
    [FinancialFeature.BUDGETING]: SubscriptionTier.BRONZE,
    [FinancialFeature.RISK_PROFILE]: SubscriptionTier.BRONZE,
    [FinancialFeature.CHECKUP]: SubscriptionTier.SILVER,
    [FinancialFeature.PENSION]: SubscriptionTier.SILVER,
    [FinancialFeature.GOALS]: SubscriptionTier.SILVER,
    [FinancialFeature.EDUCATION]: SubscriptionTier.GOLD,
    [FinancialFeature.INSURANCE]: SubscriptionTier.GOLD,
};

/**
 * Normalisasi string moduleType (misal dari DTO/token .mgc/service) menjadi FinancialFeature valid.
 */
export function normalizeModuleToFeature(moduleType?: string | null): FinancialFeature | null {
    if (!moduleType) return null;
    const key = moduleType.trim().toUpperCase();

    switch (key) {
        case 'BUDGET':
        case 'BUDGETING':
            return FinancialFeature.BUDGETING;
        case 'RISK_PROFILE':
        case 'RISK':
            return FinancialFeature.RISK_PROFILE;
        case 'CHECKUP':
        case 'FINANCIAL_CHECKUP':
            return FinancialFeature.CHECKUP;
        case 'PENSION':
            return FinancialFeature.PENSION;
        case 'GOAL':
        case 'GOALS':
            return FinancialFeature.GOALS;
        case 'EDUCATION':
            return FinancialFeature.EDUCATION;
        case 'INSURANCE':
            return FinancialFeature.INSURANCE;
        default:
            return null;
    }
}

/**
 * Menentukan tier efektif user berdasarkan status langganan & masa aktif saat ini.
 */
export function resolveEffectiveTier(
    subscription?: {
        status?: SubscriptionStatus | string | null;
        endDate?: Date | string | null;
        gracePeriodEndDate?: Date | string | null;
        plan?: { tier?: SubscriptionTier | string | null } | null;
    } | null,
    now: Date = new Date(),
): SubscriptionTier {
    if (!subscription) {
        return SubscriptionTier.BRONZE;
    }

    const isActive =
        subscription.status === SubscriptionStatus.ACTIVE &&
        !!subscription.endDate &&
        new Date(subscription.endDate) > now;

    const isGracePeriod =
        subscription.status === SubscriptionStatus.GRACE_PERIOD &&
        !!subscription.gracePeriodEndDate &&
        new Date(subscription.gracePeriodEndDate) > now;

    if (!isActive && !isGracePeriod) {
        return SubscriptionTier.BRONZE;
    }

    const rawTier = subscription.plan?.tier;
    if (rawTier === SubscriptionTier.SILVER) return SubscriptionTier.SILVER;
    if (rawTier === SubscriptionTier.GOLD) return SubscriptionTier.GOLD;
    if (rawTier === SubscriptionTier.BRONZE) return SubscriptionTier.BRONZE;

    // Fallback aman untuk paket berbayar legacy tanpa kolom tier -> setara GOLD
    return SubscriptionTier.GOLD;
}

export function getAllowedFeaturesForTier(tier: SubscriptionTier): FinancialFeature[] {
    return TIER_FEATURES_MAP[tier] ?? TIER_FEATURES_MAP[SubscriptionTier.BRONZE];
}

export function isFeatureAllowedForTier(
    tier: SubscriptionTier,
    feature: FinancialFeature,
): boolean {
    return getAllowedFeaturesForTier(tier).includes(feature);
}

export function getUpgradeMessageForFeature(feature: FinancialFeature): string {
    const featureName = FEATURE_DISPLAY_NAME[feature] || feature;
    const minTier = FEATURE_MIN_TIER[feature];

    if (minTier === SubscriptionTier.GOLD) {
        return `Fitur ${featureName} hanya tersedia pada Paket Gold. Silakan upgrade ke Paket Gold untuk membuka akses penuh.`;
    }
    if (minTier === SubscriptionTier.SILVER) {
        return `Fitur ${featureName} tersedia mulai dari Paket Silver dan Gold. Silakan upgrade paket Anda untuk menggunakan fitur ini.`;
    }
    return `Akses ke fitur ${featureName} tidak diizinkan untuk paket Anda saat ini.`;
}
