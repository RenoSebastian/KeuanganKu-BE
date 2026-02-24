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
     * Jika INVALID -> Revoke akses & kembalikan limit ke FREE (3).
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

                    // [FIX] Kembalikan jatah ke standar FREE (3 Token)
                    await tx.userUsage.update({
                        where: { userId: order.userId },
                        data: { simulationQuota: 3 },
                    });
                }
            } else if (dto.status === VerificationStatus.VALID) {
                // [FIX] Jika VALID, set kuota ke angka tinggi (9999)
                // Meskipun User PRO di-bypass logic kuotanya, ini visual yang bagus di DB
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

            // [FIX] Set jatah limit ke PRO (9999)
            await tx.userUsage.upsert({
                where: { userId },
                update: { simulationQuota: 9999 },
                create: {
                    userId,
                    simulationQuota: 9999,
                    totalUsed: 0,
                },
            });

            return subscription;
        });
    }

    /**
     * [NEW METHOD] Top Up Quota (Safety Net)
     * Admin menambahkan token kuota untuk user (misal: penanganan komplain).
     * Endpoint: PATCH /admin/subscription/topup-quota/:userId
     */
    async topUpQuota(userId: string, amount: number) {
        const usage = await this.prisma.userUsage.findUnique({
            where: { userId },
        });

        if (!usage) {
            throw new NotFoundException('Data penggunaan user (UserUsage) tidak ditemukan. User mungkin belum diinisialisasi.');
        }

        return this.prisma.userUsage.update({
            where: { userId },
            data: {
                simulationQuota: {
                    increment: amount,
                },
            },
        });
    }
}