import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import {
    SubscriptionStatus,
    NotificationType,
    NotificationCategory,
    QuotaTransactionType
} from '@prisma/client';

const FREE_TIER_QUOTA_RESET = 3; // Bantalan/Subsidi default user gratis
const GRACE_PERIOD_DAYS = 2; // Tenggang waktu 2 hari

@Injectable()
export class SubscriptionCronService {
    private readonly logger = new Logger(SubscriptionCronService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Main Cron Job: Berjalan setiap hari jam 00:00
     * Mengorkestrasikan siklus hidup langganan.
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyLifecycle() {
        this.logger.log('🔄 Running Daily Subscription Lifecycle Check...');

        try {
            await this.handleUpcomingExpirations(); // 1. Reminder H-3
            await this.handleGracePeriodEntry();    // 2. Masuk Masa Tenggang
            await this.handleFinalExpiration();     // 3. Expired & Downgrade
        } catch (error) {
            this.logger.error('❌ Critical Error in Subscription Cron', error);
        }
    }

    /**
     * TASK 1: Kirim Pengingat H-3 Sebelum Expired
     */
    private async handleUpcomingExpirations() {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const startOfDay = new Date(threeDaysFromNow.setHours(0, 0, 0, 0));
        const endOfDay = new Date(threeDaysFromNow.setHours(23, 59, 59, 999));

        const expiringSoon = await this.prisma.userSubscription.findMany({
            where: {
                status: SubscriptionStatus.ACTIVE,
                endDate: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: { plan: true },
        });

        this.logger.log(`📢 Found ${expiringSoon.length} users for H-3 Reminder.`);

        for (const sub of expiringSoon) {
            await this.notificationService.createAndSend({
                userId: sub.userId,
                title: 'Tagihan Segera Jatuh Tempo ⏳',
                message: `Paket ${sub.plan.name} Anda akan berakhir dalam 3 hari. Perpanjang sekarang agar akses simulasi tidak terputus.`,
                type: NotificationType.WARNING,
                category: NotificationCategory.SUBSCRIPTION,
            });
        }
    }

    /**
     * TASK 2: Handle Grace Period (Masa Tenggang)
     */
    private async handleGracePeriodEntry() {
        const now = new Date();

        const graceCandidates = await this.prisma.userSubscription.findMany({
            where: {
                status: SubscriptionStatus.ACTIVE,
                endDate: { lt: now },
                gracePeriodEndDate: null,
            },
            include: { plan: true },
        });

        this.logger.log(`⚠️ Entering Grace Period: ${graceCandidates.length} users.`);

        for (const sub of graceCandidates) {
            const graceEnd = new Date();
            graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

            await this.prisma.userSubscription.update({
                where: { id: sub.id },
                data: {
                    status: SubscriptionStatus.GRACE_PERIOD,
                    gracePeriodEndDate: graceEnd,
                },
            });

            await this.notificationService.createAndSend({
                userId: sub.userId,
                title: 'Masa Tenggang Dimulai ⚠️',
                message: `Langganan Anda telah berakhir. Kami memberikan waktu tambahan 48 jam sebelum akses dikunci. Segera lakukan pembayaran.`,
                type: NotificationType.ERROR,
                category: NotificationCategory.PAYMENT,
            });
        }
    }

    /**
     * TASK 3: Final Expiration & Soft-Landing Downgrade Strategy
     */
    private async handleFinalExpiration() {
        const now = new Date();

        const toExpire = await this.prisma.userSubscription.findMany({
            where: {
                OR: [
                    { status: SubscriptionStatus.GRACE_PERIOD },
                    { status: SubscriptionStatus.ACTIVE }
                ],
                gracePeriodEndDate: { lt: now },
            },
            include: { user: true, plan: true },
        });

        this.logger.log(`🛑 Final Expiration (Downgrade): ${toExpire.length} users.`);

        for (const sub of toExpire) {
            await this.prisma.$transaction(async (tx) => {
                // 1. Update Status ke EXPIRED (otomatis jatuh ke Tier BRONZE gratis tanpa batas kuota)
                await tx.userSubscription.update({
                    where: { id: sub.id },
                    data: {
                        status: SubscriptionStatus.EXPIRED,
                        updatedAt: new Date(),
                    },
                });
            });

            // 2. Notifikasi
            await this.notificationService.createAndSend({
                userId: sub.userId,
                title: 'Paket Berakhir 🔒',
                message: `Masa aktif Paket ${sub.plan.name} telah habis. Akun Anda beralih ke Paket Bronze (Gratis) dengan akses tak terbatas pada fitur Rancang Anggaran & Risk Profile.`,
                type: NotificationType.INFO,
                category: NotificationCategory.SUBSCRIPTION,
            });
        }
    }
}