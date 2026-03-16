import {
    BadRequestException,
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';
import {
    SubscriptionStatus,
    VerificationStatus,
    NotificationType,
    NotificationCategory,
    QuotaTransactionType,
} from '@prisma/client';
import { NotificationService } from '../../notification/notification.service';
import { UserQuotaService } from '../../users/services/user-quota.service';
import { AuditService } from '../../audit/audit.service';

import { RedisService } from '../../redis/redis.service';
import { NotificationGateway } from '../../notification/notification.gateway';

// Import DTO baru dari controller untuk type-safety
import { BulkVerifyDto, RevokeOrderDto } from '../controllers/admin-subscription.controller';

@Injectable()
export class AdminSubscriptionService {
    private readonly logger = new Logger(AdminSubscriptionService.name);
    private readonly METRICS_CACHE_KEY = 'admin:dashboard:metrics';

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly userQuotaService: UserQuotaService,
        private readonly auditService: AuditService,
        private readonly redisService: RedisService,
        private readonly notificationGateway: NotificationGateway,
    ) { }

    async getPendingOrders() {
        return this.prisma.subscriptionOrder.findMany({
            where: {
                verificationStatus: VerificationStatus.PENDING,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        agency: { select: { name: true } },
                    },
                },
                plan: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async verifyOrder(adminId: string, dto: VerifyOrderDto) {
        const order = await this.prisma.subscriptionOrder.findUnique({
            where: { id: dto.orderId },
            include: { plan: true },
        });

        if (!order) {
            throw new NotFoundException('Order subscription tidak ditemukan');
        }

        if (order.verificationStatus !== VerificationStatus.PENDING) {
            throw new BadRequestException('Order ini sudah diproses sebelumnya');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedOrder = await tx.subscriptionOrder.update({
                where: { id: dto.orderId },
                data: {
                    verificationStatus: dto.status,
                    adminNotes: dto.adminNotes,
                    updatedAt: new Date(),
                },
            });

            await tx.subscriptionPaymentAudit.create({
                data: {
                    orderId: dto.orderId,
                    adminId: adminId,
                    status: dto.status,
                    rejectionReason: dto.status === VerificationStatus.INVALID ? dto.adminNotes : null,
                    proofSnapshotUrl: order.proofImageUrl,
                },
            });

            if (dto.status === VerificationStatus.VALID) {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + order.plan.durationMonths);

                await tx.userSubscription.upsert({
                    where: { userId: order.userId },
                    update: {
                        status: SubscriptionStatus.ACTIVE,
                        planId: order.planId,
                        startDate,
                        endDate,
                        lastOrderId: order.id,
                    },
                    create: {
                        userId: order.userId,
                        planId: order.planId,
                        status: SubscriptionStatus.ACTIVE,
                        startDate,
                        endDate,
                        lastOrderId: order.id,
                    },
                });

                const bonusQuota = order.plan.bonusQuota || 0;
                const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId } });
                const newBalance = user.quota + bonusQuota;

                await tx.user.update({
                    where: { id: order.userId },
                    data: { quota: newBalance },
                });

                await tx.userQuotaLedger.create({
                    data: {
                        userId: order.userId,
                        amount: bonusQuota,
                        type: QuotaTransactionType.SUBSCRIPTION_RENEWAL,
                        referenceId: order.id,
                        balanceAfter: newBalance,
                        description: `Aktivasi Paket ${order.plan.name}`,
                    },
                });
            } else if (dto.status === VerificationStatus.INVALID) {
                await tx.userSubscription.updateMany({
                    where: {
                        userId: order.userId,
                        status: SubscriptionStatus.ACTIVE
                    },
                    data: {
                        status: SubscriptionStatus.REVOKED,
                        updatedAt: new Date(),
                    },
                });
            }

            return updatedOrder;
        });

        this.invalidateDashboardCache();

        this.notificationGateway.broadcastToAdmins('PAYMENT_ORDER_PROCESSED', {
            orderId: order.id,
            status: dto.status,
            adminId: adminId
        });

        await this.auditService.logAdminAction({
            adminId,
            action: dto.status === VerificationStatus.VALID ? 'APPROVE_PAYMENT' : 'REJECT_PAYMENT',
            targetUserId: order.userId,
            details: { orderId: order.id, planName: order.plan.name, reason: dto.adminNotes },
        });

        if (dto.status === VerificationStatus.VALID) {
            await this.notificationService.createAndSend({
                userId: order.userId,
                title: 'Pembayaran Diterima 🎉',
                message: `Selamat! Paket ${order.plan.name} Anda telah aktif.`,
                type: NotificationType.SUCCESS,
                category: NotificationCategory.SUBSCRIPTION,
                metadata: { orderId: order.id },
            });
        } else {
            await this.notificationService.createAndSend({
                userId: order.userId,
                title: 'Pembayaran Ditolak',
                message: `Verifikasi gagal: ${dto.adminNotes || 'Bukti tidak valid'}. Akses Pro Anda telah dicabut.`,
                type: NotificationType.ERROR,
                category: NotificationCategory.PAYMENT,
                metadata: { orderId: order.id },
            });
        }

        return result;
    }

    /**
     * [PHASE 1 ENHANCEMENT: BULK VERIFICATION]
     * Mengeksekusi verifikasi secara berurutan untuk menjaga keandalan database lock.
     * Tidak akan menggagalkan seluruh array jika ada satu yang gagal (Resilient loop).
     */
    async bulkVerifyOrders(adminId: string, dto: BulkVerifyDto) {
        const results = {
            totalProcessed: 0,
            successfulIds: [] as string[],
            failed: [] as { orderId: string, reason: string }[],
        };

        const defaultNotes = dto.adminNotes || `Bulk ${dto.status} via Command Center`;

        for (const orderId of dto.orderIds) {
            try {
                await this.verifyOrder(adminId, {
                    orderId,
                    status: dto.status,
                    adminNotes: defaultNotes
                });
                results.successfulIds.push(orderId);
            } catch (error: any) {
                results.failed.push({
                    orderId,
                    reason: error.message || 'Unknown verification error'
                });
            }
            results.totalProcessed++;
        }

        // Cache invalidate cukup dilakukan sekali di akhir proses massal (sudah dihandle dalam iterasi namun untuk keamanan ditrigger ulang jika perlu)
        this.logger.log(`Bulk Verification completed. Processed: ${results.totalProcessed}, Success: ${results.successfulIds.length}`);

        return results;
    }

    /**
     * [PHASE 1 ENHANCEMENT: COMPENSATING TRANSACTION / REVOKE]
     * Logika murni untuk menarik kembali order yang terlanjur "VALID".
     */
    async revokeOrder(adminId: string, dto: RevokeOrderDto) {
        const order = await this.prisma.subscriptionOrder.findUnique({
            where: { id: dto.orderId },
            include: { plan: true },
        });

        if (!order) throw new NotFoundException('Order subscription tidak ditemukan');
        if (order.verificationStatus !== VerificationStatus.VALID) {
            throw new BadRequestException('Hanya order yang sudah disetujui (VALID) yang dapat dibatalkan.');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Cabut Status Order
            const updatedOrder = await tx.subscriptionOrder.update({
                where: { id: dto.orderId },
                data: {
                    verificationStatus: VerificationStatus.INVALID,
                    adminNotes: `[REVOKED] ${dto.reason}`,
                    updatedAt: new Date(),
                },
            });

            // 2. Catat di Audit Keamanan
            await tx.subscriptionPaymentAudit.create({
                data: {
                    orderId: dto.orderId,
                    adminId: adminId,
                    status: VerificationStatus.INVALID,
                    rejectionReason: `[REVOKED] ${dto.reason}`,
                    proofSnapshotUrl: order.proofImageUrl,
                },
            });

            // 3. Matikan akses Premium
            await tx.userSubscription.updateMany({
                where: {
                    userId: order.userId,
                    status: SubscriptionStatus.ACTIVE,
                    lastOrderId: order.id // Pastikan hanya mematikan langganan dari order ini
                },
                data: {
                    status: SubscriptionStatus.REVOKED,
                    updatedAt: new Date(),
                },
            });

            // 4. Quota Reversal (Tarik kembali token yang diberikan)
            const bonusQuota = order.plan.bonusQuota || 0;
            const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId } });

            // Cegah saldo minus ekstrim jika user sudah menghabiskan tokennya
            const newBalance = Math.max(0, user.quota - bonusQuota);

            await tx.user.update({
                where: { id: order.userId },
                data: { quota: newBalance },
            });

            // 5. Catat Mutasi Negatif di Ledger
            await tx.userQuotaLedger.create({
                data: {
                    userId: order.userId,
                    amount: -bonusQuota, // Nilai negatif untuk penarikan
                    type: QuotaTransactionType.ADMIN_BONUS, // Menggunakan enum yang ada sebagai proxy reversal
                    referenceId: `REVOKE-${order.id}`,
                    balanceAfter: newBalance,
                    description: `Pembatalan Paket ${order.plan.name}: ${dto.reason}`,
                },
            });

            return updatedOrder;
        });

        this.invalidateDashboardCache();

        this.notificationGateway.broadcastToAdmins('PAYMENT_ORDER_REVOKED', {
            orderId: order.id,
            adminId: adminId
        });

        await this.auditService.logAdminAction({
            adminId,
            action: 'REVOKE_PAYMENT',
            targetUserId: order.userId,
            details: { orderId: order.id, planName: order.plan.name, reason: dto.reason },
        });

        await this.notificationService.createAndSend({
            userId: order.userId,
            title: 'Pembatalan Paket Akses ⚠️',
            message: `Akses paket ${order.plan.name} Anda terpaksa kami cabut. Alasan: ${dto.reason}.`,
            type: NotificationType.ERROR,
            category: NotificationCategory.SUBSCRIPTION,
            metadata: { orderId: order.id },
        });

        return result;
    }

    async manualOverride(
        adminId: string,
        userId: string,
        planId: string,
        durationMonths?: number,
        reason?: string,
    ) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: planId },
        });

        if (!plan) throw new NotFoundException('Plan tidak ditemukan');

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (durationMonths || plan.durationMonths));

        const bonusQuota = plan.bonusQuota || 50;

        await this.userQuotaService.addQuota(
            userId,
            bonusQuota,
            QuotaTransactionType.ADMIN_BONUS,
            adminId,
            `Manual Override: ${reason || 'Bonus Marketing'}`,
        );

        const subscription = await this.prisma.userSubscription.upsert({
            where: { userId },
            update: {
                status: SubscriptionStatus.ACTIVE,
                planId: plan.id,
                startDate,
                endDate,
            },
            create: {
                userId,
                status: SubscriptionStatus.ACTIVE,
                planId: plan.id,
                startDate,
                endDate,
                lastOrderId: 'MANUAL_GRANT',
            },
        });

        this.invalidateDashboardCache();

        await this.auditService.logAdminAction({
            adminId,
            action: 'OVERRIDE_SUBSCRIPTION',
            targetUserId: userId,
            details: { planId, durationMonths, reason },
        });

        await this.notificationService.createAndSend({
            userId: userId,
            title: 'Aktivasi Paket Spesial',
            message: `Admin telah mengaktifkan paket ${plan.name} secara manual.`,
            type: NotificationType.INFO,
            category: NotificationCategory.SYSTEM,
        });

        return subscription;
    }

    async injectQuota(
        adminId: string,
        userId: string,
        amount: number,
        reason: string,
    ) {
        const result = await this.userQuotaService.addQuota(
            userId,
            amount,
            QuotaTransactionType.ADMIN_BONUS,
            adminId,
            reason,
        );

        await this.auditService.logAdminAction({
            adminId,
            action: 'INJECT_QUOTA',
            targetUserId: userId,
            details: { amount, reason, newBalance: result.currentBalance },
        });

        await this.notificationService.createAndSend({
            userId: userId,
            title: 'Bonus Token Simulasi',
            message: `Admin menambahkan ${amount} token. Total kuota: ${result.currentBalance}.`,
            type: NotificationType.SUCCESS,
            category: NotificationCategory.QUOTA,
        });

        return result;
    }

    private invalidateDashboardCache() {
        this.redisService.del(this.METRICS_CACHE_KEY)
            .then(() => this.logger.debug(`Cache invalidated: ${this.METRICS_CACHE_KEY}`))
            .catch((err) => this.logger.warn(`Gagal menghapus cache metrics dashboard: ${err.message}`));
    }
}