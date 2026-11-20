import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media/services/media-storage.service';
import { CreateSubscriptionOrderDto } from '../dto/create-subscription-order.dto';
import { SubscriptionStatus, VerificationStatus, VoucherUsageStatus } from '@prisma/client';
import { NotificationGateway } from '../../notification/notification.gateway';
import { VoucherService } from './voucher.service';
import {
    resolveEffectiveTier,
    TIER_DISPLAY_NAME,
    TIER_RANK,
} from '../../../common/constants/tier-features.constant';

@Injectable()
export class SubscriptionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaStorageService: MediaStorageService,
        private readonly notificationGateway: NotificationGateway,
        private readonly voucherService: VoucherService,
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
            include: {
                plan: true,
                voucher: true,
            },
            orderBy: { createdAt: 'desc' }, // Terbaru di atas
        });

        // [FIX MUTLAK] Sanitasi Memori
        return JSON.parse(JSON.stringify(orders));
    }

    /**
     * [POINT 6] Backend Unique Code Generator
     * Menghindari kolisi nominal transfer antar user pada antrean PENDING
     */
    async generateAvailableUniqueCode(): Promise<number> {
        const pendingOrders = await this.prisma.subscriptionOrder.findMany({
            where: { verificationStatus: VerificationStatus.PENDING },
            select: { uniqueCode: true },
        });

        const usedCodes = new Set(pendingOrders.map(o => o.uniqueCode));

        for (let i = 0; i < 50; i++) {
            const candidate = Math.floor(100 + Math.random() * 899);
            if (!usedCodes.has(candidate)) {
                return candidate;
            }
        }
        return Math.floor(100 + Math.random() * 899);
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

        // 2.1 Validasi Anti-Downgrade (Mencegah user Gold aktif menimpa paketnya ke Silver secara tidak sengaja)
        const existingSubPrecheck = await this.prisma.userSubscription.findUnique({
            where: { userId },
            include: { plan: true },
        });
        const currentEffectiveTier = resolveEffectiveTier(existingSubPrecheck);
        if (TIER_RANK[plan.tier] < TIER_RANK[currentEffectiveTier]) {
            throw new BadRequestException(
                `Anda sedang berlangganan Paket ${TIER_DISPLAY_NAME[currentEffectiveTier]} yang masih aktif. Tidak dapat berpindah ke Paket ${TIER_DISPLAY_NAME[plan.tier]} sebelum masa aktif berakhir.`,
            );
        }

        // 2.3 Validasi & Alokasi Kode Unik Aman (Zero Collision)
        let assignedUniqueCode = Number(dto.uniqueCode) || 0;
        if (!assignedUniqueCode || assignedUniqueCode <= 0) {
            assignedUniqueCode = await this.generateAvailableUniqueCode();
        }

        // [CORE LOGIC FIX]: Lock harga murni menggunakan Net Price (Harga Promosi)
        let lockedPrice = Number(plan.price);
        let discountAmount = 0;
        let voucherId: string | null = null;
        let voucherCodeApplied: string | null = null;

        // 2.5 Validasi Voucher jika dikirimkan
        if (dto.voucherCode && dto.voucherCode.trim()) {
            const voucherResult = await this.voucherService.validateVoucher(
                userId,
                dto.voucherCode,
                dto.planId,
            );
            discountAmount = voucherResult.discountAmount;
            lockedPrice = voucherResult.finalPrice;
            voucherId = voucherResult.voucher.id;
            voucherCodeApplied = voucherResult.voucher.code;
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
                    uniqueCode: assignedUniqueCode,
                    proofImageUrl,
                    snapshotPrice: lockedPrice, // Snapshot dikunci pada harga setelah diskon voucher
                    voucherId,
                    discountAmount,
                    verificationStatus: VerificationStatus.PENDING, // Admin belum cek
                },
            });

            // B. Catat Pemakaian Voucher (Status PENDING)
            if (voucherId) {
                await tx.voucherUsage.create({
                    data: {
                        voucherId,
                        userId,
                        orderId: order.id,
                        appliedAmount: discountAmount,
                        status: VoucherUsageStatus.PENDING,
                    },
                });
            }

            // C. Hitung Tanggal Berakhir (EndDate)
            // Akumulatif hanya untuk perpanjangan tier yang SAMA. Upgrade tier memulai periode baru dari hari ini.
            const currentSub = await tx.userSubscription.findUnique({
                where: { userId },
                include: { plan: true },
            });

            const now = new Date();
            const isCurrentActive = currentSub &&
                currentSub.status === SubscriptionStatus.ACTIVE &&
                currentSub.endDate &&
                new Date(currentSub.endDate) > now;

            const isSameTierRenewal = isCurrentActive && currentSub.plan?.tier === plan.tier;

            const baseDate = isSameTierRenewal ? new Date(currentSub.endDate) : now;
            const monthsToAdd = plan.durationMonths && plan.durationMonths > 0 ? plan.durationMonths : 1;
            const endDate = new Date(baseDate);
            endDate.setMonth(endDate.getMonth() + monthsToAdd);

            const startDate = isSameTierRenewal ? currentSub.startDate : now;

            // D. UPSERT UserSubscription (Optimistic Activation)
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

            // E. Broadcast Real-time Event ke Admin Dashboard
            this.notificationGateway.broadcastToAdmins('NEW_PAYMENT_ORDER', {
                orderId: order.id,
                userId: userId,
                planName: plan.name,
                snapshotPrice: lockedPrice,
                voucherCode: voucherCodeApplied,
                discountAmount,
                createdAt: order.createdAt,
            });

            return {
                message: 'Paket berhasil diaktifkan. Menunggu verifikasi admin.',
                subscription,
                order,
            };
        });
    }
}