import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
    RevenueMetricsDto,
    UserMetricsDto,
    SystemUsageMetricsDto,
    FeatureUsageDto
} from '../dto/dashboard-metrics-response.dto';
import {
    CashflowLedgerResponseDto,
    CashflowLedgerItemDto,
    CashflowStatus
} from '../dto/cashflow-ledger.dto';

@Injectable()
export class AdminAnalyticsService {
    private readonly logger = new Logger(AdminAnalyticsService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Menghitung metrik pendapatan (Gross, MRR, Pending)
     * Menggunakan tabel SubscriptionOrder dan UserSubscription
     */
    async calculateRevenueMetrics(): Promise<RevenueMetricsDto> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        try {
            const [grossAgg, pendingAgg, mrrRaw] = await Promise.all([
                // 1. Hitung Gross Volume (Pendapatan Kotor bulan ini) dari Order yang VALID
                this.prisma.subscriptionOrder.aggregate({
                    _sum: { snapshotPrice: true },
                    where: {
                        verificationStatus: 'VALID',
                        createdAt: { gte: startOfMonth },
                    },
                }),

                // 2. Hitung Nominal Pending dari Order yang belum di-ACC
                this.prisma.subscriptionOrder.aggregate({
                    _sum: { snapshotPrice: true },
                    where: { verificationStatus: 'PENDING' },
                }),

                // 3. [PHASE 4 HARDENING: OOM PREVENTION] 
                // Kalkulasi MRR menggunakan Database-level Aggregation via $queryRaw.
                // Ini mencegah Node.js Crash karena kehabisan RAM jika ada jutaan data langganan aktif.
                this.prisma.$queryRaw<Array<{ mrr: number | null }>>`
                    SELECT SUM(p.price / p."durationMonths") as mrr
                    FROM "UserSubscription" us
                    INNER JOIN "SubscriptionPlan" p ON us."planId" = p.id
                    WHERE us.status = 'ACTIVE' 
                    AND us."endDate" > ${now} 
                    AND p."durationMonths" > 0
                `
            ]);

            // Ekstrak hasil raw query yang dikerjakan langsung oleh PostgreSQL
            const mrrValue = mrrRaw[0]?.mrr ? Number(mrrRaw[0].mrr) : 0;

            return {
                grossVolume: Number(grossAgg._sum.snapshotPrice || 0),
                mrr: Math.round(mrrValue),
                pendingValue: Number(pendingAgg._sum.snapshotPrice || 0),
            };
        } catch (error) {
            this.logger.error(`Gagal menghitung Revenue Metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Menghitung metrik pengguna (Total, DAU, MAU, Konversi)
     */
    async calculateUserMetrics(): Promise<UserMetricsDto> {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        try {
            const [totalUsers, dau, mau, premiumUsers] = await Promise.all([
                // 1. Total user (Abaikan yang ter-Soft Delete)
                this.prisma.user.count({ where: { deletedAt: null } }),

                // 2. Daily Active Users (Menggunakan lastActivityAt)
                this.prisma.activeSession.count({
                    where: { lastActivityAt: { gte: startOfDay } },
                }),

                // 3. Monthly Active Users
                this.prisma.activeSession.count({
                    where: { lastActivityAt: { gte: startOfMonth } },
                }),

                // 4. Pengguna dengan langganan aktif (Menggunakan relasi database level)
                this.prisma.user.count({
                    where: {
                        deletedAt: null,
                        subscription: {
                            status: 'ACTIVE',
                            endDate: { gt: new Date() }
                        }
                    }
                }),
            ]);

            const conversionRate = totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0;

            return {
                totalUsers,
                dau,
                mau,
                conversionRate: parseFloat(conversionRate.toFixed(2)),
            };
        } catch (error) {
            this.logger.error(`Gagal menghitung User Metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Menghitung utilitas fitur dari tabel simulation_log
     */
    async calculateFeatureUtilization(): Promise<SystemUsageMetricsDto> {
        try {
            const [logsGrouped, quotaUsageAgg] = await Promise.all([
                // 1. Grouping berdasarkan moduleType (BUDGETING, PENSION, dll) - Native Postgres GroupBy
                this.prisma.simulationLog.groupBy({
                    by: ['moduleType'],
                    _count: { _all: true },
                    orderBy: { _count: { moduleType: 'desc' } },
                }),

                // 2. Rata-rata total penggunaan kuota oleh pengguna gratis (USER biasa)
                this.prisma.userUsage.aggregate({
                    _avg: { totalUsed: true },
                    where: { user: { role: 'USER' } }
                }),
            ]);

            const totalSimulations = logsGrouped.reduce((acc, curr) => acc + curr._count._all, 0);

            const featureDistribution: FeatureUsageDto[] = logsGrouped.map(item => ({
                featureName: item.moduleType,
                usageCount: item._count._all,
                percentage: totalSimulations > 0
                    ? parseFloat(((item._count._all / totalSimulations) * 100).toFixed(2))
                    : 0,
            }));

            return {
                featureDistribution,
                averageFreeQuotaConsumption: quotaUsageAgg._avg.totalUsed ? parseFloat(quotaUsageAgg._avg.totalUsed.toFixed(2)) : 0,
            };
        } catch (error) {
            this.logger.error(`Gagal menghitung Feature Utilization: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Mengambil buku besar arus kas dari SubscriptionOrder
     */
    async getCashflowLedger(page: number, limit: number): Promise<CashflowLedgerResponseDto> {
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

            const mappedData: CashflowLedgerItemDto[] = transactions.map(trx => {
                let ledgerStatus: CashflowStatus = CashflowStatus.PENDING;
                if (trx.verificationStatus === 'VALID') ledgerStatus = CashflowStatus.VERIFIED;
                else if (trx.verificationStatus === 'INVALID') ledgerStatus = CashflowStatus.REJECTED;

                return {
                    transactionId: trx.id,
                    transactionDate: trx.updatedAt,
                    planName: trx.plan?.name || 'Unknown Plan',
                    amount: Number(trx.snapshotPrice || 0),
                    status: ledgerStatus,
                    verifiedBy: trx.paymentAudit?.adminId ? `Admin ID: ${trx.paymentAudit.adminId}` : undefined,
                    userName: trx.user?.fullName || 'Unknown User',
                };
            });

            return {
                data: mappedData,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Gagal mengambil Cashflow Ledger: ${error.message}`, error.stack);
            throw error;
        }
    }
}