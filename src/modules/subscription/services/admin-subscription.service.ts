import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';
import { SubscriptionStatus, VerificationStatus } from '@prisma/client';

@Injectable()
export class AdminSubscriptionService {
    constructor(private readonly prisma: PrismaService) { }

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
     * Core Logic: Admin Validator dengan Sinkronisasi Kuota
     * Jika VALID -> Tetapkan limit PRO (9999).
     * Jika INVALID -> Revoke akses & kembalikan limit ke FREE (5).
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

        return this.prisma.$transaction(async (tx) => {
            // 2. Update Status Order
            const updatedOrder = await tx.subscriptionOrder.update({
                where: { id: dto.orderId },
                data: {
                    verificationStatus: dto.status,
                    adminNotes: dto.adminNotes,
                    updatedAt: new Date(),
                },
            });

            // 3. Logic Branching berdasarkan keputusan Admin
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

                    // Kembalikan jatah limit ke standar FREE
                    await tx.userUsage.update({
                        where: { userId: order.userId },
                        data: { clientLimit: 5 },
                    });
                }
            } else if (dto.status === VerificationStatus.VALID) {
                // Jika VALID, pastikan jatah limit sudah diset ke PRO (unlimited/9999)
                // Hal ini memperkuat 'Optimistic Activation' yang dilakukan di SubscriptionService
                await tx.userUsage.upsert({
                    where: { userId: order.userId },
                    update: { clientLimit: 9999 },
                    create: {
                        userId: order.userId,
                        clientLimit: 9999,
                        clientCount: 0,
                    },
                });
            }

            return updatedOrder;
        });
    }

    /**
     * Manual Override (Super User Feature)
     * Admin memberikan paket PRO secara manual dan otomatis menaikkan limit.
     */
    async manualOverride(userId: string, planId: string, durationMonths?: number) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: planId },
        });

        if (!plan) throw new NotFoundException('Plan tidak ditemukan');

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (durationMonths || plan.durationMonths));

        return this.prisma.$transaction(async (tx) => {
            // Upsert Status Berlangganan
            const subscription = await tx.userSubscription.upsert({
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
                    lastOrderId: '', // Dummy/Empty untuk manual override
                },
            });

            // Set jatah limit ke PRO
            await tx.userUsage.upsert({
                where: { userId },
                update: { clientLimit: 9999 },
                create: {
                    userId,
                    clientLimit: 9999,
                    clientCount: 0,
                },
            });

            return subscription;
        });
    }

    /**
     * Menambahkan Bonus Kuota (The Balance Logic)
     * Admin menambah jatah 'clientLimit' tanpa mengubah status subscription.
     */
    async addBonusQuota(userId: string, bonusAmount: number) {
        const usage = await this.prisma.userUsage.findUnique({
            where: { userId },
        });

        if (!usage) {
            throw new NotFoundException('Data penggunaan user (UserUsage) tidak ditemukan');
        }

        return this.prisma.userUsage.update({
            where: { userId },
            data: {
                clientLimit: {
                    increment: bonusAmount,
                },
            },
        });
    }
}