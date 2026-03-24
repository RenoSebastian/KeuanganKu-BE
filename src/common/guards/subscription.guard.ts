import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // Pastikan path import sesuai
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    private readonly logger = new Logger(SubscriptionGuard.name);

    // [FASE 4] Ambang batas ekstrem untuk melindungi server dari scraping/abuse oleh akun PRO
    private readonly FUP_HARD_LIMIT = 10000;

    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // 1. Pastikan User sudah Login (Validasi Identitas)
        if (!user || !user.id) {
            throw new UnauthorizedException('User tidak terautentikasi.');
        }

        // 2. Ambil Data Context Lengkap (Subscription + Usage)
        const userData = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                subscription: true,
                usage: true,
            },
        });

        if (!userData) {
            throw new UnauthorizedException('Data profil tidak ditemukan di database.');
        }

        const now = new Date();
        const isPro = userData.subscription &&
            userData.subscription.status === SubscriptionStatus.ACTIVE &&
            userData.subscription.endDate &&
            userData.subscription.endDate > now;

        const totalUsed = userData.usage?.totalUsed || 0;
        const remainingQuota = userData.usage?.simulationQuota || 0;

        // ====================================================
        // LEVEL 1: CEK STATUS PREMIUM & FAIR USAGE POLICY (FUP)
        // ====================================================
        if (isPro) {
            // Evaluasi FUP: Mencegah akun PRO melakukan eksploitasi sistem
            if (totalUsed >= this.FUP_HARD_LIMIT) {
                this.logger.warn(`[SECURITY ALERT] FUP Breach: User ${user.id} exceeded ${this.FUP_HARD_LIMIT} requests.`);
                throw new ForbiddenException(
                    'Akses diblokir sementara karena melanggar Fair Usage Policy (Terdeteksi lalu lintas data tidak wajar). Hubungi Admin.'
                );
            }
            // Lolos sebagai pengguna berbayar (PRO)
            return true;
        }

        // ====================================================
        // LEVEL 2: CEK KUOTA FREE (HARD LIMIT)
        // ====================================================
        // Jika sampai sini, berarti User adalah FREE atau Langganan Expired
        if (remainingQuota > 0) {
            // Lolos menggunakan Token Gratis
            // NOTE: Pengurangan kuota (-1) murni dilakukan di Service Layer, bukan di Guard.
            return true;
        }

        // ====================================================
        // LEVEL 3: BLOCKING (GAME OVER)
        // ====================================================
        throw new ForbiddenException(
            'Kuota simulasi gratis Anda telah habis (0). Silakan perpanjang langganan PRO untuk melanjutkan akses.'
        );
    }
}