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
     * Menambah saldo kuota user (Debit).
     * Digunakan oleh: Subscription Service (saat bayar), Admin Manual Inject.
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
     * Mengurangi saldo kuota user (Kredit).
     * Digunakan oleh: Simulation Services (saat user generate report).
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

        // Kirim amount sebagai negatif ke prosesor internal
        return this.processTransaction(userId, -amount, type, referenceId, description);
    }

    /**
     * [INTERNAL] ATOMIC TRANSACTION PROCESSOR
     * Menjamin sinkronisasi antara tabel User (Cache) dan UserQuotaLedger (Audit Trail).
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
                // 1. Lock & Get User Data (Mencegah Race Condition)
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { id: true, quota: true },
                });

                if (!user) {
                    throw new NotFoundException(`User dengan ID ${userId} tidak ditemukan`);
                }

                // 2. Hitung Saldo Baru
                const currentBalance = user.quota ?? 0;
                const newBalance = currentBalance + amountChange;

                // 3. Validasi: Saldo tidak boleh negatif
                if (newBalance < 0) {
                    this.logger.warn(
                        `Insufficient Quota: User ${userId} attempted -${Math.abs(amountChange)} but only has ${currentBalance}`,
                    );
                    throw new BadRequestException(
                        'Kuota tidak mencukupi untuk melakukan aksi ini.',
                    );
                }

                // 4. Update User Cache Balance (Tabel users)
                await tx.user.update({
                    where: { id: userId },
                    data: { quota: newBalance },
                });

                // 5. Create Ledger Entry (Tabel user_quota_ledgers)
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
                `Failed to process quota transaction for user ${userId}: ${error.message}`,
                error.stack,
            );
            throw new InternalServerErrorException(
                'Terjadi kesalahan pada sistem manajemen kuota.',
            );
        }
    }

    /**
     * [READ] GET HISTORY
     * Mengambil riwayat mutasi kuota user untuk transparansi audit nasabah.
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
     * Menghitung ulang saldo user berdasarkan seluruh transaksi di Ledger.
     * Digunakan jika ada kecurigaan integritas data kolom cache 'quota'.
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
     * Helper: Generate deskripsi otomatis jika tidak disediakan.
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
            default:
                return `Transaksi kuota ${type}`;
        }
    }
}