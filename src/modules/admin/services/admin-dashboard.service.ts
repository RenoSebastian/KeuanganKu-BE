import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VerificationStatus } from '@prisma/client';

// Import layanan pendukung untuk Fase 3
import { RedisService } from '../../redis/redis.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardMetricsResponseDto } from '../dto/dashboard-metrics-response.dto';

// [NEW IMPORTS] Untuk orkestrasi Password Reset & Audit
import { AuthService } from '../../auth/auth.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AdminDashboardService {
    private readonly logger = new Logger(AdminDashboardService.name);
    private readonly METRICS_CACHE_KEY = 'admin:dashboard:metrics';

    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
        private readonly analyticsService: AdminAnalyticsService,

        // [NEW DEPENDENCIES] Injeksi layanan untuk Security Event
        private readonly authService: AuthService,
        private readonly auditService: AuditService
    ) { }

    // =========================================================================
    // FASE 3: CORE ANALYTICS ORCHESTRATOR & CACHING
    // =========================================================================

    /**
     * Mengambil metrik lengkap (Revenue, Users, Usage) dengan perlindungan Redis
     */
    async getDashboardMetrics(): Promise<DashboardMetricsResponseDto> {
        try {
            // 1. Cek apakah data metrik sudah ada di Redis Cache
            const cachedMetrics = await this.redisService.get(this.METRICS_CACHE_KEY);
            if (cachedMetrics) {
                this.logger.debug('Menyajikan Dashboard Metrics dari Redis Cache');
                return JSON.parse(cachedMetrics) as DashboardMetricsResponseDto;
            }

            this.logger.debug('Cache Miss: Menghitung ulang Dashboard Metrics via Analytics Engine...');

            // 2. Jika tidak ada di cache, perintahkan Engine untuk menghitung (Paralel)
            const [revenue, users, systemUsage] = await Promise.all([
                this.analyticsService.calculateRevenueMetrics(),
                this.analyticsService.calculateUserMetrics(),
                this.analyticsService.calculateFeatureUtilization()
            ]);

            const response: DashboardMetricsResponseDto = {
                revenue,
                users,
                systemUsage,
                lastUpdatedAt: new Date()
            };

            // 3. Simpan hasil agregasi ke Redis dengan Time-To-Live (TTL) 1 Jam (3600 detik)
            // Ini menjamin DB tidak akan diserang query berat terus-menerus
            await this.redisService.set(this.METRICS_CACHE_KEY, JSON.stringify(response), 3600);

            return response;
        } catch (error) {
            this.logger.error(`Gagal mengambil Dashboard Metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
      * Mengambil buku besar arus kas dari SubscriptionOrder
      * [FIX MUTLAK] Bypass NestJS Interceptor dengan sanitasi memori langsung
      */
    async getCashflowLedger(page: number, limit: number): Promise<any> {
        const skip = (page - 1) * limit;

        try {
            const [transactions, total] = await Promise.all([
                this.prisma.subscriptionOrder.findMany({
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    where: { deletedAt: null },
                    include: {
                        user: { select: { fullName: true } },
                        plan: { select: { name: true } },
                        paymentAudit: true // Untuk mendapatkan ID admin yang verifikasi
                    },
                }),
                this.prisma.subscriptionOrder.count({ where: { deletedAt: null } }),
            ]);

            const mappedData = transactions.map(trx => {
                let ledgerStatus = 'PENDING';
                if (trx.verificationStatus === 'VALID') ledgerStatus = 'VERIFIED';
                else if (trx.verificationStatus === 'INVALID') ledgerStatus = 'REJECTED';

                return {
                    transactionId: trx.id,
                    // EKSEKUSI PAKSA: Ubah ke String sebelum framework menyentuhnya
                    transactionDate: trx.updatedAt ? trx.updatedAt.toISOString() : null,
                    planName: trx.plan?.name || 'Unknown Plan',
                    amount: Number(trx.snapshotPrice || 0) + Number((trx as any).uniqueCode || 0),
                    status: ledgerStatus,
                    verifiedBy: trx.paymentAudit?.adminId ? `Admin ID: ${trx.paymentAudit.adminId}` : undefined,
                    userName: trx.user?.fullName || 'Unknown User',
                };
            });

            // PENYEGELAN MEMORI: 
            // Memaksa objek menjadi JSON primitive utuh untuk mematikan semua anomali Prisma/NestJS
            const finalResponse = JSON.parse(JSON.stringify({
                data: mappedData,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            }));

            return finalResponse;
        } catch (error) {
            this.logger.error(`Gagal mengambil Cashflow Ledger: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getDashboardStats() {
        // [FASE 3 OPTIMIZATION] Hitung User Online langsung dari SCAN Redis (In-Memory)
        // Menghindari query COUNT ke MySQL tabel ActiveSession yang berat
        const onlineUsersCount = await this.redisService.getOnlineUsersCount();

        // 2. Hitung Total User Terdaftar
        const totalUsers = await this.prisma.user.count({
            where: { role: 'USER' },
        });

        // 3. Hitung Pendapatan (Revenue)
        const revenueAgg = await this.prisma.subscriptionOrder.aggregate({
            where: {
                verificationStatus: VerificationStatus.VALID,
            },
            _sum: {
                snapshotPrice: true,
            },
        });

        const totalRevenue = revenueAgg._sum.snapshotPrice || 0;

        // 4. Hitung Pending Approval (Action Item buat Admin)
        const pendingApprovals = await this.prisma.subscriptionOrder.count({
            where: {
                verificationStatus: VerificationStatus.PENDING,
            },
        });

        return {
            onlineUsers: onlineUsersCount,
            totalUsers,
            totalRevenue: Number(totalRevenue), // Convert Decimal to Number
            pendingApprovals,
            generatedAt: new Date(),
        };
    }

    async getOnlineUsersList() {
        // [FASE 3 OPTIMIZATION] Ambil data User Online dari SCAN Redis (In-Memory)
        const onlineSessions = await this.redisService.getOnlineUsersDetailed();

        // Format data agar sesuai ekspektasi struktur FE (menyerupai data dari Prisma)
        return onlineSessions.map(session => ({
            id: `redis-${session.userId}-${session.deviceId}`,
            userId: session.userId,
            deviceId: session.deviceId,
            lastActivityAt: new Date(session.lastSeen),
            user: {
                id: session.userId,
                fullName: session.userName,
                email: 'Redis Cached', // Untuk efisiensi kita tidak join DB disini, fallback UI
                agency: null
            }
        })).sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    }

    // =========================================================================
    // FASE 4: SECURITY ENFORCEMENT (MAGIC LINK TRIGGER & AUDIT)
    // =========================================================================

    /**
     * Memfasilitasi pemicuan email Magic Link untuk target user.
     * Mengimplementasikan pola Information Expert.
     */
    async triggerPasswordReset(adminId: string, targetUserId: string) {
        // 1. Validasi Eksistensi Target User
        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, email: true, fullName: true, role: true }
        });

        if (!targetUser) {
            throw new NotFoundException(`User dengan ID ${targetUserId} tidak ditemukan.`);
        }

        this.logger.warn(`[High-Risk Operation] Admin ${adminId} memicu siklus reset sandi untuk User: ${targetUser.email}`);

        // 2. Delegasi ke Domain Pakar (Auth Service)
        // Memanggil fungsi forgotPassword yang sekarang menghasilkan Magic Link
        await this.authService.forgotPassword({ email: targetUser.email });

        // 3. Pencatatan Jejak (Non-Repudiation) secara asinkron
        this.auditService.logAdminAction({
            adminId: adminId,
            action: 'TRIGGER_PASSWORD_RESET_LINK',
            targetUserId: targetUser.id,
            details: {
                entityName: 'USER',
                before: null,
                after: { status: 'MAGIC_LINK_SENT_TO_USER' },
                changes: { reason: 'Admin memicu pengiriman Magic Link pemulihan.' }
            }
        }).catch(e => this.logger.error(`[CRITICAL] Gagal mencatat Audit Log: ${e.message}`));

        // [REFACTORED] Pesan disesuaikan dengan arsitektur Magic Link
        return {
            message: `Tautan pemulihan aman (Magic Link) berhasil dikirimkan ke email target (${targetUser.email}). Administrator tidak memiliki akses lebih lanjut terhadap sandi baru.`
        };
    }
}