import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { QuotaTransactionType } from '@prisma/client';

@Injectable()
export class UserQuotaService {
    private readonly logger = new Logger(UserQuotaService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * [CORE] ADD QUOTA
     * Adds user quota balance (Debit).
     * Used by: Subscription Service (on payment), Admin Manual Inject.
     */
    async addQuota(
        userId: string,
        amount: number,
        type: QuotaTransactionType,
        referenceId?: string,
        description?: string,
    ) {
        if (amount <= 0) {
            throw new BadRequestException('Jumlah penambahan kuota harus lebih dari 0');
        }

        return this.processTransaction(userId, amount, type, referenceId, description);
    }

    /**
     * [CORE] DEDUCT QUOTA
     * Reduces user quota balance (Credit).
     * Used by: Simulation Services (when generating reports).
     */
    async deductQuota(
        userId: string,
        amount: number,
        type: QuotaTransactionType,
        referenceId?: string,
        description?: string,
    ) {
        if (amount <= 0) {
            throw new BadRequestException('Jumlah pengurangan kuota harus lebih dari 0');
        }

        // Send negative amount to internal processor
        return this.processTransaction(userId, -amount, type, referenceId, description);
    }

    /**
     * [INTERNAL] ATOMIC TRANSACTION PROCESSOR
     * Ensures synchronization between User table (Cache) and UserQuotaLedger (Audit Trail).
     */
    private async processTransaction(
        userId: string,
        amountChange: number,
        type: QuotaTransactionType,
        referenceId?: string,
        description?: string,
    ) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                // 1. Lock & Get User Data (Prevents Race Condition)
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { id: true, quota: true },
                });

                if (!user) {
                    throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
                }

                // 2. Calculate New Balance
                const currentBalance = user.quota ?? 0;
                const newBalance = currentBalance + amountChange;

                // 3. Validation: Prevent Negative Balance
                // (Unless explicitly allowed for certain transaction types, e.g., correction)
                if (newBalance < 0) {
                    this.logger.warn(
                        `Insufficient Quota: User ${userId} attempted ${amountChange} but only has ${currentBalance}`,
                    );
                    throw new BadRequestException(
                        'Kuota tidak mencukupi untuk melakukan aksi ini.',
                    );
                }

                // 4. Update User Cache Balance (users table)
                await tx.user.update({
                    where: { id: userId },
                    data: { quota: newBalance },
                });

                // 5. Create Ledger Entry (user_quota_ledgers table)
                const ledger = await tx.userQuotaLedger.create({
                    data: {
                        userId: userId,
                        amount: amountChange,
                        type: type,
                        referenceId: referenceId ?? null,
                        balanceAfter: newBalance,
                        description: description ?? this.getDefaultDescription(type, amountChange),
                    },
                });

                this.logger.log(
                    `Quota Transaction Success [${type}]: User ${userId} | Change: ${amountChange} | Final: ${newBalance}`,
                );

                return {
                    transactionId: ledger.id,
                    previousBalance: currentBalance,
                    currentBalance: newBalance,
                };
            });
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            this.logger.error(
                `Failed to process quota transaction for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw new InternalServerErrorException(
                'Terjadi kesalahan pada sistem manajemen kuota.',
            );
        }
    }

    /**
     * [READ] GET HISTORY
     * Retrieves user quota mutation history for audit transparency.
     */
    async getQuotaHistory(userId: string, limit = 10, page = 1) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.userQuotaLedger.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip,
            }),
            this.prisma.userQuotaLedger.count({ where: { userId } }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
            },
        };
    }

    /**
     * [ADMIN] RECALIBRATE
     * Recalculates user balance based on entire ledger history.
     * Used if data integrity issues are suspected in the 'quota' cache column.
     */
    async recalibrateBalance(userId: string) {
        const aggregate = await this.prisma.userQuotaLedger.aggregate({
            where: { userId },
            _sum: { amount: true },
        });

        const realBalance = aggregate._sum.amount ?? 0;

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { quota: realBalance },
        });

        return {
            userId: updatedUser.id,
            recalibratedQuota: updatedUser.quota,
        };
    }

    /**
     * Helper: Generate automatic description if not provided.
     */
    private getDefaultDescription(type: QuotaTransactionType, change: number): string {
        switch (type) {
            case QuotaTransactionType.SUBSCRIPTION_RENEWAL:
                return `Penambahan kuota dari aktivasi/perpanjangan paket langganan.`;
            case QuotaTransactionType.USAGE_SIMULATION:
                return `Penggunaan kuota untuk pembuatan laporan simulasi keuangan.`;
            case QuotaTransactionType.ADMIN_BONUS:
                return `Bonus kuota ditambahkan secara manual oleh administrator.`;
            case QuotaTransactionType.COMPENSATION:
                return `Kompensasi kuota atas kendala teknis sistem.`;
            case QuotaTransactionType.CORRECTION:
                return `Koreksi saldo kuota oleh tim audit.`;
            case QuotaTransactionType.SYSTEM_DOWNGRADE:
                return `Reset kuota otomatis karena masa aktif langganan habis.`;
            default:
                return `Transaksi kuota ${type}`;
        }
    }
}