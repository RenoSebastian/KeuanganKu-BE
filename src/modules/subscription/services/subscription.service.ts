import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media/services/media-storage.service';
import { CreateSubscriptionOrderDto } from '../dto/create-subscription-order.dto';
import { SubscriptionStatus, VerificationStatus } from '@prisma/client';

@Injectable()
export class SubscriptionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaStorageService: MediaStorageService,
    ) { }

    /**
     * Mengambil daftar paket langganan yang aktif (Master Data)
     */
    async getPlans() {
        return this.prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' },
        });
    }

    /**
     * [NEW] Mengambil riwayat seluruh order/transaksi milik user
     */
    async getMyOrders(userId: string) {
        return this.prisma.subscriptionOrder.findMany({
            where: { userId },
            include: {
                plan: true, // Sertakan info paket
            },
            orderBy: {
                createdAt: 'desc', // Urutkan dari yang terbaru
            },
        });
    }

    /**
     * [NEW] Mengambil status subscription aktif milik user saat ini
     */
    async getMySubscription(userId: string) {
        const subscription = await this.prisma.userSubscription.findUnique({
            where: { userId },
            include: {
                plan: true,
                lastOrder: true,
            },
        });

        if (!subscription) {
            return null;
        }

        return subscription;
    }

    /**
     * Core Logic: Optimistic Activation
     * User upload bukti -> Order dibuat -> User langsung ACTIVE
     * (Unlimited Quota di-handle via bypass status ACTIVE, bukan hardcode DB)
     */
    async subscribe(
        userId: string,
        dto: CreateSubscriptionOrderDto,
        file: Express.Multer.File,
    ) {
        // 1. Validasi File
        if (!file) {
            throw new BadRequestException('Bukti transfer wajib diupload');
        }

        // 2. Validasi Plan
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: dto.planId },
        });

        if (!plan || !plan.isActive) {
            throw new NotFoundException('Paket langganan tidak ditemukan atau tidak aktif');
        }

        // 3. Upload Bukti ke Storage
        const uploadResult = await this.mediaStorageService.uploadFile(
            file,
            'subscription-proofs',
        );
        const proofImageUrl = uploadResult.url;

        // 4. Jalankan Transaksi Database Atomic
        return this.prisma.$transaction(async (tx) => {
            // A. Buat Record Order (History)
            const order = await tx.subscriptionOrder.create({
                data: {
                    userId,
                    planId: plan.id,
                    proofImageUrl,
                    snapshotPrice: plan.price,
                    verificationStatus: VerificationStatus.PENDING, // Admin belum cek
                },
            });

            // B. Hitung Tanggal Berakhir (EndDate)
            const startDate = new Date();
            const endDate = new Date(startDate);
            // Asumsi durationMonths ada di schema, jika pakai durationDays ganti logicnya
            if (plan.durationMonths) {
                endDate.setMonth(endDate.getMonth() + plan.durationMonths);
            } else {
                // Fallback default 1 bulan jika data kosong
                endDate.setMonth(endDate.getMonth() + 1);
            }

            // C. UPSERT UserSubscription (Optimistic Activation)
            const subscription = await tx.userSubscription.upsert({
                where: { userId },
                update: {
                    status: SubscriptionStatus.ACTIVE, // Langsung Aktif!
                    planId: plan.id,
                    startDate: startDate,
                    endDate: endDate,
                    lastOrderId: order.id,
                },
                create: {
                    userId,
                    status: SubscriptionStatus.ACTIVE, // Langsung Aktif!
                    planId: plan.id,
                    startDate: startDate,
                    endDate: endDate,
                    lastOrderId: order.id,
                },
                include: {
                    plan: true,
                },
            });

            // [PERBAIKAN ARSITEKTUR]: Blok update simulationQuota menjadi 9999 (Destructive Update)
            // TELAH DIHAPUS. Akses unlimited ditangani murni dari validasi status ACTIVE 
            // di layer service pengecekan kuota. Immutable Quota State tercapai.

            return {
                message: 'Paket berhasil diaktifkan. Menunggu verifikasi admin.',
                subscription,
                order,
            };
        });
    }
}