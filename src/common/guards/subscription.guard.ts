import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';
import {
    FinancialFeature,
    getUpgradeMessageForFeature,
    isFeatureAllowedForTier,
    resolveEffectiveTier,
} from '../constants/tier-features.constant';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    private readonly logger = new Logger(SubscriptionGuard.name);

    // Ambang batas ekstrem (Fair Usage Policy) untuk melindungi server dari scraping/abuse
    private readonly FUP_HARD_LIMIT = 10000;

    constructor(
        private readonly prisma: PrismaService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // 1. Validasi Identitas User
        if (!user || !user.id) {
            throw new UnauthorizedException('User tidak terautentikasi.');
        }

        // 2. Ambil Data Context Lengkap (Subscription + Plan Tier + Usage)
        const userData = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                subscription: {
                    include: { plan: true },
                },
                usage: true,
            },
        });

        if (!userData) {
            throw new UnauthorizedException('Data profil tidak ditemukan di database.');
        }

        // 3. Evaluasi FUP (Anti-Abuse untuk semua tier)
        const totalUsed = userData.usage?.totalUsed || 0;
        if (totalUsed >= this.FUP_HARD_LIMIT) {
            this.logger.warn(
                `[SECURITY ALERT] FUP Breach: User ${user.id} exceeded ${this.FUP_HARD_LIMIT} requests.`,
            );
            throw new ForbiddenException(
                'Akses diblokir sementara karena melanggar Fair Usage Policy (Terdeteksi lalu lintas data tidak wajar). Hubungi Admin.',
            );
        }

        // 4. Resolve Tier Efektif User (BRONZE | SILVER | GOLD)
        const effectiveTier = resolveEffectiveTier(userData.subscription);

        // 5. Cek Feature Gate jika route memiliki metadata @RequireFeature(...)
        const requiredFeature = this.reflector.getAllAndOverride<FinancialFeature | undefined>(
            REQUIRED_FEATURE_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (requiredFeature && !isFeatureAllowedForTier(effectiveTier, requiredFeature)) {
            this.logger.warn(
                `[TIER GATE] User ${user.id} (${effectiveTier}) blocked from accessing ${requiredFeature}.`,
            );
            throw new ForbiddenException(getUpgradeMessageForFeature(requiredFeature));
        }

        // Lolos: Semua tier memiliki penggunaan UNLIMITED untuk fitur yang masuk paketnya
        return true;
    }
}
