import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionCronService {
    private readonly logger = new Logger(SubscriptionCronService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Cron Job: Berjalan setiap hari pada tengah malam (00:00).
     * Tugas: Mencari subscription yang ACTIVE tapi endDate-nya sudah lewat, lalu set ke EXPIRED.
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleExpiration() {
        this.logger.log('Running Subscription Expiration Check...');

        const now = new Date();

        try {
            // Update Massal (Bulk Update) untuk efisiensi performa
            const result = await this.prisma.userSubscription.updateMany({
                where: {
                    status: SubscriptionStatus.ACTIVE,
                    endDate: {
                        lt: now, // lt = less than (kurang dari waktu sekarang)
                    },
                },
                data: {
                    status: SubscriptionStatus.EXPIRED,
                    updatedAt: now,
                },
            });

            if (result.count > 0) {
                this.logger.log(
                    `✅ Successfully expired ${result.count} subscriptions.`,
                );
            } else {
                this.logger.log('ℹ️ No expired subscriptions found today.');
            }
        } catch (error) {
            this.logger.error(
                '❌ Failed to execute subscription expiration cron job',
                error.stack,
            );
        }
    }
}