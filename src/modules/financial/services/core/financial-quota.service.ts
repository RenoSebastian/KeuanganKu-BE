import {
    Injectable,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { NotificationService } from '../../../notification/notification.service';
import { NotificationType, NotificationCategory } from '@prisma/client';

@Injectable()
export class FinancialQuotaService {
    private readonly logger = new Logger(FinancialQuotaService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Core Logic: Validasi Akses & Potong Kuota
     * 1. Cek Subscription (PRO = Bypass).
     * 2. Cek Idempotency/Session (Revisi = Gratis).
     * 3. Cek Token (Free User = Bayar 1 Token).
     * 4. Kirim Notifikasi jika Token Menipis.
     */
    async validateAndDeductQuota(userId: string, sessionId: string): Promise<boolean> {
        // 1. Cek Status PRO (Unlimited Pass)
        const subscription = await this.prisma.userSubscription.findUnique({
            where: { userId },
        });

        if (subscription && subscription.status === 'ACTIVE') {
            return true; // Bypass untuk User PRO
        }

        // 2. Cek Riwayat Session (Idempotency Check - Revisi Gratis)
        // Kita cari apakah user ini sudah pernah melakukan simulasi dengan Session ID yang sama
        const existingSession = await this.prisma.simulationLog.findFirst({
            where: {
                agentId: userId,
                sessionId: sessionId,
            },
        });

        if (existingSession) {
            return true; // Revisi Gratis (Sudah pernah bayar untuk sesi ini)
        }

        // 3. Logic Token untuk User FREE (Atomic Transaction)
        return this.prisma.$transaction(async (tx) => {
            let usage = await tx.userUsage.findUnique({
                where: { userId },
            });

            // Handle jika user belum punya record usage (Edge Case/New User)
            if (!usage) {
                usage = await tx.userUsage.create({
                    data: { userId, simulationQuota: 10, totalUsed: 0 },
                });
            }

            if (usage.simulationQuota <= 0) {
                throw new ForbiddenException(
                    'Kuota simulasi gratis Anda telah habis. Silakan Upgrade ke PRO untuk akses tanpa batas.',
                );
            }

            // Potong 1 Token
            const updatedUsage = await tx.userUsage.update({
                where: { userId },
                data: {
                    simulationQuota: { decrement: 1 },
                    totalUsed: { increment: 1 },
                },
            });

            // 4. Trigger Notifikasi jika kuota menipis (Sisa 1)
            if (updatedUsage.simulationQuota === 1) {
                // Fire-and-forget notification agar tidak memblokir response
                setImmediate(() => {
                    this.notificationService
                        .createAndSend({
                            userId,
                            title: 'Kuota Hampir Habis ⚠️',
                            message:
                                'Perhatian! Kuota simulasi gratis Anda tinggal 1 token lagi. Segera upgrade ke PRO untuk layanan tanpa batas.',
                            type: NotificationType.WARNING,
                            category: NotificationCategory.QUOTA,
                        })
                        .catch((e) =>
                            this.logger.error('Failed sending quota warning', e),
                        );
                });
            }

            return true; // Sukses potong kuota
        });
    }
}