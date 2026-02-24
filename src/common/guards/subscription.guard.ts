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

        // 1. Pastikan User sudah Login (Validasi Identitas)
        if (!user || !user.id) {
            throw new UnauthorizedException('User tidak terautentikasi');
        }

        // 2. Ambil Data Context Lengkap (Subscription + Usage)
        // Kita butuh melihat dua sisi: Status Langganan DAN Sisa Kuota
        const userData = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                subscription: true, // Untuk cek status PRO
                usage: true,        // Untuk cek sisa Token/Kuota
            },
        });

        if (!userData) {
            throw new UnauthorizedException('Data user tidak ditemukan di database');
        }

        // ====================================================
        // LEVEL 1: CEK STATUS PREMIUM (UNLIMITED ACCESS)
        // ====================================================
        const hasActiveSubscription =
            userData.subscription &&
            userData.subscription.status === SubscriptionStatus.ACTIVE &&
            userData.subscription.endDate > new Date(); // Pastikan belum expired

        if (hasActiveSubscription) {
            // User adalah PRO, izinkan lewat tanpa cek kuota
            return true;
        }

        // ====================================================
        // LEVEL 2: CEK KUOTA FREE (TOKEN BUCKET)
        // ====================================================
        // Jika sampai sini, berarti User adalah FREE (atau Sub Expired)

        // Ambil sisa kuota (Default 0 jika record usage belum ada)
        const remainingQuota = userData.usage?.simulationQuota ?? 0;

        if (remainingQuota > 0) {
            // User masih punya Token Gratis, izinkan lewat.
            // NOTE: Pengurangan kuota (-1) dilakukan di Service Layer, bukan di Guard.
            return true;
        }

        // ====================================================
        // LEVEL 3: BLOCKING (GAME OVER)
        // ====================================================
        // Bukan PRO dan Tidak Punya Kuota
        throw new ForbiddenException(
            'Kuota simulasi gratis Anda telah habis (0). Silakan upgrade ke PRO untuk akses tanpa batas.',
        );
    }
}