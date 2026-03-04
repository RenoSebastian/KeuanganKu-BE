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

@Injectable()
export class AdminSubscriptionService {
    private readonly logger = new Logger(AdminSubscriptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly userQuotaService: UserQuotaService, // Ledger System
        private readonly auditService: AuditService, // Audit Trail
    ) { }

    /**
     * Mengambil daftar order yang belum divalidasi
     */
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

    /**
     * [CORE] VALIDASI PEMBAYARAN (Enhanced)
     * Menyimpan alasan reject ke tabel Audit & Update Kuota via Ledger
     */
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

        // [ATOMIC TRANSACTION]
        // Menjamin integritas data: Status, Audit, Subscription, dan Kuota
        const result = await this.prisma.$transaction(async (tx) => {
            // 1. Update Status Order Utama
            const updatedOrder = await tx.subscriptionOrder.update({
                where: { id: dto.orderId },
                data: {
                    verificationStatus: dto.status,
                    adminNotes: dto.adminNotes,
                    updatedAt: new Date(),
                },
            });

            // 2. Simpan ke Audit Log Pembayaran (Anti-Fraud)
            // Menyimpan alasan penolakan secara permanen di tabel terpisah
            await tx.subscriptionPaymentAudit.create({
                data: {
                    orderId: dto.orderId,
                    adminId: adminId,
                    status: dto.status,
                    rejectionReason:
                        dto.status === VerificationStatus.INVALID ? dto.adminNotes : null,
                    proofSnapshotUrl: order.proofImageUrl,
                },
            });

            // 3. Logic Approval: Aktifkan Paket & Tambah Kuota
            if (dto.status === VerificationStatus.VALID) {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + order.plan.durationMonths);

                // a. Upsert User Subscription
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

                // b. Tambah Kuota (Direct DB Update dalam TX yang sama agar atomik)
                const bonusQuota = order.plan.bonusQuota || 0;

                // Ambil saldo terakhir untuk perhitungan ledger
                const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId } });
                const newBalance = user.quota + bonusQuota;

                // Update saldo di tabel User (Cache)
                await tx.user.update({
                    where: { id: order.userId },
                    data: { quota: newBalance },
                });

                // Insert ke Ledger (Audit Trail Kuota)
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
            }

            return updatedOrder;
        });

        // 4. Post-Process (Audit Umum & Notifikasi)
        // Dilakukan di luar transaksi DB agar tidak memperlambat locking row
        await this.auditService.logAdminAction({
            adminId,
            action:
                dto.status === VerificationStatus.VALID
                    ? 'APPROVE_PAYMENT'
                    : 'REJECT_PAYMENT',
            targetUserId: order.userId,
            details: {
                orderId: order.id,
                planName: order.plan.name,
                reason: dto.adminNotes,
            },
        });

        // Kirim Notifikasi ke User
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
                message: `Verifikasi gagal: ${dto.adminNotes || 'Bukti tidak valid'}`,
                type: NotificationType.ERROR,
                category: NotificationCategory.PAYMENT,
                metadata: { orderId: order.id },
            });
        }

        return result;
    }

    /**
     * [ADMIN FEATURE] Manual Override / Grant Access
     * Memberikan paket langganan secara manual (misal: hadiah/kompensasi)
     */
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
        endDate.setMonth(
            endDate.getMonth() + (durationMonths || plan.durationMonths),
        );

        const bonusQuota = plan.bonusQuota || 50;

        // 1. Tambah Quota (Panggil Service Ledger)
        await this.userQuotaService.addQuota(
            userId,
            bonusQuota,
            QuotaTransactionType.ADMIN_BONUS,
            adminId, // Reference ID bisa Admin ID
            `Manual Override: ${reason || 'Bonus Marketing'}`,
        );

        // 2. Aktifkan Subscription
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

        // 3. Log Audit
        await this.auditService.logAdminAction({
            adminId,
            action: 'OVERRIDE_SUBSCRIPTION',
            targetUserId: userId,
            details: { planId, durationMonths, reason },
        });

        // 4. Notifikasi
        await this.notificationService.createAndSend({
            userId: userId,
            title: 'Aktivasi Paket Spesial',
            message: `Admin telah mengaktifkan paket ${plan.name} secara manual.`,
            type: NotificationType.INFO,
            category: NotificationCategory.SYSTEM,
        });

        return subscription;
    }

    /**
     * [ADMIN FEATURE] Inject Quota Only
     * Menambahkan token kuota tanpa mengubah status langganan.
     */
    async injectQuota(
        adminId: string,
        userId: string,
        amount: number,
        reason: string,
    ) {
        // 1. Panggil Ledger Service
        const result = await this.userQuotaService.addQuota(
            userId,
            amount,
            QuotaTransactionType.ADMIN_BONUS,
            adminId,
            reason,
        );

        // 2. Log Audit
        await this.auditService.logAdminAction({
            adminId,
            action: 'INJECT_QUOTA',
            targetUserId: userId,
            details: { amount, reason, newBalance: result.currentBalance },
        });

        // 3. Notifikasi
        await this.notificationService.createAndSend({
            userId: userId,
            title: 'Bonus Token Simulasi',
            message: `Admin menambahkan ${amount} token. Total kuota: ${result.currentBalance}.`,
            type: NotificationType.SUCCESS,
            category: NotificationCategory.QUOTA,
        });

        return result;
    }
}