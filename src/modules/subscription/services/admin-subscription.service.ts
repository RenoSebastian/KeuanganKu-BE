import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';
import {
    SubscriptionStatus,
    VerificationStatus,
    NotificationType,
    NotificationCategory,
} from '@prisma/client';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class AdminSubscriptionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService, // [NEW] Inject Notification Service
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
     * Core Logic: Admin Validator dengan Sinkronisasi Kuota & Notifikasi
     * Jika VALID -> Tetapkan limit PRO (9999) + Kirim Notif Sukses
     * Jika INVALID -> Revoke akses & kembalikan limit ke FREE (3) + Kirim Notif Gagal
     */
    async verifyOrder(adminId: string, dto: VerifyOrderDto) {
        // 1. Ambil Order Target
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

        // 2. Proses Database (Atomic Transaction)
        const result = await this.prisma.$transaction(async (tx) => {
            // Update Status Order
            const updatedOrder = await tx.subscriptionOrder.update({
                where: { id: dto.orderId },
                data: {
                    verificationStatus: dto.status,
                    adminNotes: dto.adminNotes,
                    updatedAt: new Date(),
                },
            });

            // Logic Branching berdasarkan keputusan Admin
            if (dto.status === VerificationStatus.INVALID) {
                const currentSub = await tx.userSubscription.findUnique({
                    where: { userId: order.userId },
                });

                // Revoke akses jika order terakhir adalah yang sedang ditolak
                if (currentSub && currentSub.lastOrderId === order.id) {
                    await tx.userSubscription.update({
                        where: { userId: order.userId },
                        data: {
                            status: SubscriptionStatus.REVOKED,
                            endDate: new Date(), // Langsung kedaluwarsa
                        },
                    });

                    // Kembalikan jatah ke standar FREE (3 Token)
                    await tx.userUsage.update({
                        where: { userId: order.userId },
                        data: { simulationQuota: 3 },
                    });
                }
            } else if (dto.status === VerificationStatus.VALID) {
                // Jika VALID, set kuota ke angka tinggi (9999)
                await tx.userUsage.upsert({
                    where: { userId: order.userId },
                    update: { simulationQuota: 9999 },
                    create: {
                        userId: order.userId,
                        simulationQuota: 9999,
                        totalUsed: 0,
                    },
                });
            }

            return updatedOrder;
        });

        // 3. Trigger Notifikasi (Fire-and-Forget)
        // Dilakukan setelah transaksi sukses agar user mendapat update real-time
        if (dto.status === VerificationStatus.VALID) {
            await this.notificationService.createAndSend({
                userId: order.userId,
                title: 'Pembayaran Diterima 🎉',
                message: `Selamat! Paket ${order.plan.name} Anda telah aktif. Nikmati akses simulasi tanpa batas.`,
                type: NotificationType.SUCCESS,
                category: NotificationCategory.SUBSCRIPTION,
                metadata: { orderId: order.id },
            });
        } else if (dto.status === VerificationStatus.INVALID) {
            await this.notificationService.createAndSend({
                userId: order.userId,
                title: 'Pembayaran Ditolak',
                message: dto.adminNotes
                    ? `Verifikasi gagal: ${dto.adminNotes}`
                    : 'Bukti pembayaran tidak valid atau tidak terbaca. Silakan cek kembali dan upload ulang.',
                type: NotificationType.ERROR,
                category: NotificationCategory.PAYMENT,
                metadata: { orderId: order.id },
            });
        }

        return result;
    }

    /**
     * Manual Override (Super User Feature)
     * Admin memberikan paket PRO secara manual dan otomatis menaikkan limit.
     */
    async manualOverride(
        userId: string,
        planId: string,
        durationMonths?: number,
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

        const subscription = await this.prisma.$transaction(async (tx) => {
            // Upsert Status Berlangganan
            const sub = await tx.userSubscription.upsert({
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
                    lastOrderId: '', // Note: Pastikan field ini nullable di schema atau isi dengan Dummy Order ID
                },
            });

            // Set jatah limit ke PRO (9999)
            await tx.userUsage.upsert({
                where: { userId },
                update: { simulationQuota: 9999 },
                create: {
                    userId,
                    simulationQuota: 9999,
                    totalUsed: 0,
                },
            });

            return sub;
        });

        // Trigger Notifikasi Manual Activation
        await this.notificationService.createAndSend({
            userId: userId,
            title: 'Aktivasi Manual Berhasil',
            message: `Admin telah mengaktifkan paket ${plan.name
                } untuk akun Anda. Aktif hingga ${endDate.toLocaleDateString('id-ID')}.`,
            type: NotificationType.INFO,
            category: NotificationCategory.SYSTEM,
        });

        return subscription;
    }

    /**
     * Top Up Quota (Safety Net)
     * Admin menambahkan token kuota untuk user.
     */
    async topUpQuota(userId: string, amount: number) {
        const usage = await this.prisma.userUsage.findUnique({
            where: { userId },
        });

        if (!usage) {
            throw new NotFoundException(
                'Data penggunaan user tidak ditemukan. User mungkin belum diinisialisasi.',
            );
        }

        const updated = await this.prisma.userUsage.update({
            where: { userId },
            data: {
                simulationQuota: {
                    increment: amount,
                },
            },
        });

        // Trigger Notifikasi Quota Added
        await this.notificationService.createAndSend({
            userId: userId,
            title: 'Bonus Kuota Simulasi',
            message: `Admin menambahkan ${amount} token simulasi tambahan ke akun Anda. Sisa kuota saat ini: ${updated.simulationQuota}.`,
            type: NotificationType.SUCCESS,
            category: NotificationCategory.QUOTA,
        });

        return updated;
    }
}