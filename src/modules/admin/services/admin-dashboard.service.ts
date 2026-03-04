import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { VerificationStatus } from '@prisma/client';

@Injectable()
export class AdminDashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getDashboardStats() {
        // 1. Hitung User Online (Real-time dari tabel ActiveSession)
        // Kita anggap "Online" jika aktif dalam 5 menit terakhir
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
        // Diambil dari Audit Pembayaran yang statusnya VALID
        // Kita perlu join ke SubscriptionOrder untuk dapat snapshotPrice
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

    /**
     * [OPTIONAL] List User yang sedang online beserta detailnya
     */
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