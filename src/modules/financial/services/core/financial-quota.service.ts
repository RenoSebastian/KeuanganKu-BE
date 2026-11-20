import {
    Injectable,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
    getUpgradeMessageForFeature,
    isFeatureAllowedForTier,
    normalizeModuleToFeature,
    resolveEffectiveTier,
} from '../../../../common/constants/tier-features.constant';

@Injectable()
export class FinancialQuotaService {
    private readonly logger = new Logger(FinancialQuotaService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Defense-in-Depth Feature Gate & Usage Telemetry (Unlimited Usage per Tier).
     * Memastikan user hanya dapat mengeksekusi modul yang termasuk dalam tier aktifnya
     * (BRONZE / SILVER / GOLD) tanpa lagi membatasi atau memotong kuota token.
     */
    async validateAndDeductQuota(
        userId: string,
        sessionId: string,
        moduleType: string,
        txContext?: Prisma.TransactionClient,
    ): Promise<boolean> {
        const db = txContext || this.prisma;

        // 1. Cek Tier Efektif User dari Subscription + Plan
        const subscription = await db.userSubscription.findUnique({
            where: { userId },
            include: { plan: true },
        });

        const effectiveTier = resolveEffectiveTier(subscription);
        const feature = normalizeModuleToFeature(moduleType);

        if (feature && !isFeatureAllowedForTier(effectiveTier, feature)) {
            this.logger.warn(
                `[SERVICE TIER GATE] User ${userId} (${effectiveTier}) ditolak mengakses modul ${feature}.`,
            );
            throw new ForbiddenException(getUpgradeMessageForFeature(feature));
        }

        // 2. Idempotency Check untuk pencatatan statistik totalUsed (FUP & Analytics)
        const existingSession = await db.simulationLog.findFirst({
            where: {
                agentId: userId,
                sessionId: sessionId,
                moduleType: moduleType,
            },
        });

        if (existingSession) {
            return true;
        }

        // 3. Catat statistik penggunaan (totalUsed) tanpa pemotongan kuota (Unlimited)
        await db.userUsage.upsert({
            where: { userId },
            update: {
                totalUsed: { increment: 1 },
            },
            create: {
                userId,
                simulationQuota: 0,
                totalUsed: 1,
            },
        });

        return true;
    }

    /**
     * Validasi akses fitur murni (misal untuk decode file .mgc atau export PDF).
     */
    async assertFeatureAccess(userId: string, moduleType: string): Promise<void> {
        const feature = normalizeModuleToFeature(moduleType);
        if (!feature) return;

        const subscription = await this.prisma.userSubscription.findUnique({
            where: { userId },
            include: { plan: true },
        });

        const effectiveTier = resolveEffectiveTier(subscription);
        if (!isFeatureAllowedForTier(effectiveTier, feature)) {
            throw new ForbiddenException(getUpgradeMessageForFeature(feature));
        }
    }
}
