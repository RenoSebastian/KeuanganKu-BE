import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // 1. Pastikan User sudah Login (di-handle oleh JwtAuthGuard sebelumnya)
        if (!user || !user.id) {
            throw new UnauthorizedException('User tidak terautentikasi');
        }

        // 2. Ambil Data Subscription Aktif dari Database
        // Kita query langsung agar data real-time (bukan dari payload token yang mungkin stale)
        const subscription = await this.prisma.userSubscription.findUnique({
            where: { userId: user.id },
        });

        // Cek 1: Apakah record ada?
        if (!subscription) {
            throw new ForbiddenException(
                'Fitur ini hanya untuk pengguna Berlangganan (Premium). Silakan upgrade paket Anda.',
            );
        }

        // Cek 2: Apakah status == ACTIVE?
        if (subscription.status !== SubscriptionStatus.ACTIVE) {
            throw new ForbiddenException(
                'Masa langganan Anda tidak aktif atau telah dibekukan.',
            );
        }

        // Cek 3: Apakah endDate > now()?
        const now = new Date();
        if (subscription.endDate < now) {
            throw new ForbiddenException(
                'Masa langganan Anda telah berakhir (Expired). Silakan perpanjang untuk akses fitur ini.',
            );
        }

        // Jika semua lolos, izinkan akses
        return true;
    }
}