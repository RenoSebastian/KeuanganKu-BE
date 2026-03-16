import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VerificationStatus } from '@prisma/client';

// Import layanan pendukung untuk Fase 3
import { RedisService } from '../../redis/redis.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardMetricsResponseDto } from '../dto/dashboard-metrics-response.dto';

@Injectable()
export class AdminDashboardService {
    private readonly logger = new Logger(AdminDashboardService.name);
    private readonly METRICS_CACHE_KEY = 'admin:dashboard:metrics';

    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
        private readonly analyticsService: AdminAnalyticsService
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
     * Mengambil daftar buku besar (Ledger) arus kas.
     * Tidak kita cache karena memiliki paginasi dan butuh akurasi real-time tingkat tinggi.
     */
    async getCashflowLedger(page: number, limit: number) {
        return this.analyticsService.getCashflowLedger(page, limit);
    }

    // =========================================================================
    // EXISTING METHODS
    // =========================================================================

    async getDashboardStats() {
        // 1. Hitung User Online (Real-time dari tabel ActiveSession)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const onlineUsersCount = await this.prisma.activeSession.count({
            where: {
                lastActivityAt: {
                    gte: fiveMinutesAgo,
                },
            },
        });

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
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        return this.prisma.activeSession.findMany({
            where: {
                lastActivityAt: { gte: fiveMinutesAgo },
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
            },
            orderBy: { lastActivityAt: 'desc' },
        });
    }
}