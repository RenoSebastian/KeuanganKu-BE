import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media/services/media-storage.service';
import { CreateSubscriptionOrderDto } from '../dto/create-subscription-order.dto';
import { SubscriptionStatus, VerificationStatus } from '@prisma/client';
import { NotificationGateway } from '../../notification/notification.gateway';

@Injectable()
export class SubscriptionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaStorageService: MediaStorageService,
        private readonly notificationGateway: NotificationGateway,
    ) { }

    /**
     * Mengambil daftar paket langganan yang aktif (Master Data)
     */
    async getPlans() {
        const plans = await this.prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' },
        });

        // [FIX MUTLAK] Sanitasi Memori untuk membunuh anomali Decimal {s,e,d} dan Date {}
        return JSON.parse(JSON.stringify(plans));
    }

    // Fungsi untuk Mengambil Status Langganan Aktif User
    async getMySubscription(userId: string) {
        const subscription = await this.prisma.userSubscription.findUnique({
            where: { userId },
            include: { plan: true },
        });

        if (!subscription) return null;

        // [FIX MUTLAK] Sanitasi Memori
        return JSON.parse(JSON.stringify(subscription));
    }

    // Fungsi untuk Mengambil Riwayat Order User
    async getMyOrders(userId: string) {
        const orders = await this.prisma.subscriptionOrder.findMany({
            where: { userId },
            include: { plan: true },
            orderBy: { createdAt: 'desc' }, // Terbaru di atas
        });

        // [FIX MUTLAK] Sanitasi Memori
        return JSON.parse(JSON.stringify(orders));
    }

    /**
     * Core Logic: Optimistic Activation
     * User upload bukti -> Order dibuat -> User langsung ACTIVE
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

        // [CORE LOGIC FIX]: Lock harga murni menggunakan Net Price (Harga Promosi)
        // Kita tidak lagi mengkalikan dengan durationMonths karena plan.price di DB 
        // sudah merupakan harga total paket bundling (contoh: 12 bulan = Rp 1.350.000).
        // Kita mengabaikan originalPrice karena itu hanya untuk gimmick UI Frontend.
        const lockedPrice = Number(plan.price);

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
                    uniqueCode: Number(dto.uniqueCode) || 0,
                    proofImageUrl,
                    snapshotPrice: lockedPrice, // Snapshot dikunci pada harga promo yang berlaku saat checkout
                    verificationStatus: VerificationStatus.PENDING, // Admin belum cek
                } as any, // Cast to any because Prisma Client is locked and not fully regenerated
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

            // D. Broadcast Real-time Event ke Admin Dashboard
            this.notificationGateway.broadcastToAdmins('NEW_PAYMENT_ORDER', {
                orderId: order.id,
                userId: userId,
                planName: plan.name,
                snapshotPrice: lockedPrice, // Broadcast nilai mutlak untuk ditampilkan di UI Antrean
                createdAt: order.createdAt
            });

            return {
                message: 'Paket berhasil diaktifkan. Menunggu verifikasi admin.',
                subscription,
                order,
            };
        });
    }
}