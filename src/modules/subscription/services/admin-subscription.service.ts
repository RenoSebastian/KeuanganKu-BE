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
     * Core Logic: Admin Validator
     * Jika VALID -> Biarkan.
     * Jika INVALID -> Revoke akses user (Matikan Subscription).
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

        // 2. Update Status Order
        const updatedOrder = await this.prisma.subscriptionOrder.update({
            where: { id: dto.orderId },
            data: {
                verificationStatus: dto.status,
                adminNotes: dto.adminNotes,
                updatedAt: new Date(),
                // Idealnya kita simpan adminId siapa yang memvalidasi di field auditorId (jika ada)
            },
        });

        // 3. Logic Branching: Revocation
        if (dto.status === VerificationStatus.INVALID) {
            // Cari Subscription Aktif User Ini
            const currentSub = await this.prisma.userSubscription.findUnique({
                where: { userId: order.userId },
            });

            // SAFETY CHECK:
            // Kita hanya membatalkan subscription jika 'lastOrderId'-nya adalah order yang sedang kita tolak ini.
            // Jika user sudah melakukan order BARU lagi setelah order ini, jangan batalkan yang baru.
            if (currentSub && currentSub.lastOrderId === order.id) {
                await this.prisma.userSubscription.update({
                    where: { userId: order.userId },
                    data: {
                        status: SubscriptionStatus.REVOKED,
                        // Opsional: Set endDate ke waktu lampau agar pasti expired
                        endDate: new Date(),
                    },
                });
            }
        }

        return updatedOrder;
    }

    /**
     * Manual Override (Super User Feature)
     * Admin memberikan paket secara manual tanpa pembayaran/bukti.
     */
    async manualOverride(userId: string, planId: string, durationMonths?: number) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: planId },
        });

        if (!plan) throw new NotFoundException('Plan tidak ditemukan');

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (durationMonths || plan.durationMonths));

        // Kita tidak membuat SubscriptionOrder karena ini manual override
        // Atau bisa buat dummy order jika audit strict diperlukan

        return this.prisma.userSubscription.upsert({
            where: { userId },
            update: {
                status: SubscriptionStatus.ACTIVE,
                planId: plan.id,
                startDate,
                endDate,
                // lastOrderId dibiarkan tetap (atau null jika skema mengizinkan)
            },
            create: {
                userId,
                status: SubscriptionStatus.ACTIVE,
                planId: plan.id,
                startDate,
                endDate,
                lastOrderId: '', // Perlu handle constraint ini jika required. 
                // Solusi: Buat dummy order sistem atau ubah schema lastOrderId jadi optional.
                // Untuk sekarang kita asumsikan admin override jarang dipakai di fase awal.
            },
        });
    }
}