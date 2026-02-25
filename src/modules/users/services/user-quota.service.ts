import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

// Enum untuk menstandarisasi tipe transaksi kuota
export enum QuotaTransactionType {
    SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL', // Otomatis dari subscription
    ADMIN_BONUS = 'ADMIN_BONUS',                   // Manual inject oleh Admin
    USAGE_SIMULATION = 'USAGE_SIMULATION',         // Terpakai saat simulasi
    COMPENSATION = 'COMPENSATION',                 // Ganti rugi error sistem
    CORRECTION = 'CORRECTION',                     // Koreksi data audit
}

@Injectable()
export class UserQuotaService {
    private readonly logger = new Logger(UserQuotaService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * [CORE] ADD QUOTA
     * Menambah saldo kuota user.
     * Digunakan oleh: Subscription Service, Admin Manual Inject.
     */
    async addQuota(
        userId: string,
        amount: number,
        type: QuotaTransactionType,
        referenceId?: string, // Bisa berupa Order ID, atau Admin ID
        reason?: string,
    ) {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be positive for addition');
        }

        return this.processTransaction(userId, amount, type, referenceId, reason);
    }

    /**
     * [CORE] DEDUCT QUOTA
     * Mengurangi saldo kuota user.
     * Digunakan oleh: Simulation Services (saat user klik "Generate PDF").
     */
    async deductQuota(
        userId: string,
        amount: number,
        type: QuotaTransactionType,
        referenceId?: string, // Bisa berupa Simulation ID
    ) {
        if (amount <= 0) {
            throw new BadRequestException('Amount must be positive for deduction');
        }

        // Kirim amount sebagai negatif ke prosesor
        return this.processTransaction(userId, -amount, type, referenceId);
    }

    /**
     * [INTERNAL] ATOMIC TRANSACTION PROCESSOR
     * Menangani logika perubahan saldo agar sinkron antara tabel User dan Ledger.
     * Menggunakan Prisma Interactive Transaction ($transaction).
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
                // 1. Lock & Get User Data
                // Mengambil data user terbaru untuk memastikan perhitungan saldo akurat
                const user = await tx.user.findUniqueOrThrow({
                    where: { id: userId },
                    select: { id: true, quota: true },
                });

                // 2. Calculate New Balance
                const currentBalance = user.quota ?? 0;
                const newBalance = currentBalance + amountChange;

                // 3. Validation: Prevent Negative Balance
                if (newBalance < 0) {
                    this.logger.warn(
                        `User ${userId} attempted usage exceeding quota. Curr: ${currentBalance}, Req: ${Math.abs(amountChange)}`,
                    );
                    throw new BadRequestException('Kuota simulasi tidak mencukupi.');
                }

                // 4. Update User Balance
                await tx.user.update({
                    where: { id: userId },
                    data: { quota: newBalance },
                });

                // 5. Insert Ledger Entry (Audit Trail)
                // Mencatat detail transaksi agar bisa diaudit
                const ledgerEntry = await tx.userQuotaLedger.create({
                    data: {
                        userId: userId,
                        amount: amountChange,
                        type: type,
                        referenceId: referenceId ?? null,
                        balanceAfter: newBalance,
                        // Simpan metadata tambahan di kolom description atau metadata (jika schema mendukung JSON)
                        description: description ?? null,
                    },
                });

                this.logger.log(
                    `Quota Tx Success [${type}]: User ${userId} | ${amountChange > 0 ? '+' : ''}${amountChange} | Final: ${newBalance}`,
                );

                return {
                    success: true,
                    previousBalance: currentBalance,
                    newBalance: newBalance,
                    transactionId: ledgerEntry.id,
                };
            });
        } catch (error) {
            // Re-throw BadRequestException agar sampai ke Controller dengan pesan yang benar
            if (error instanceof BadRequestException) {
                throw error;
            }

            this.logger.error(
                `Failed to process quota transaction for user ${userId}`,
                error instanceof Error ? error.stack : String(error),
            );
            throw new InternalServerErrorException(
                'Gagal memproses transaksi kuota. Silakan coba lagi.',
            );
        }
    }

    /**
     * [READ] GET HISTORY
     * Mengambil riwayat mutasi kuota untuk ditampilkan di halaman Profile/Subscription User.
     */
    async getQuotaHistory(userId: string, limit = 20, offset = 0) {
        const history = await this.prisma.userQuotaLedger.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            select: {
                id: true,
                amount: true,
                type: true,
                balanceAfter: true,
                createdAt: true,
                description: true,
            },
        });

        const total = await this.prisma.userQuotaLedger.count({
            where: { userId },
        });

        return {
            data: history,
            meta: {
                total,
                limit,
                offset,
            },
        };
    }

    /**
     * [ADMIN] SYNC BALANCE
     * Fungsi darurat untuk menghitung ulang saldo user berdasarkan ledger
     * jika dicurigai ada ketidakcocokan data (Data Integrity Check).
     */
    async recalibrateBalance(userId: string) {
        const aggregations = await this.prisma.userQuotaLedger.aggregate({
            where: { userId },
            _sum: {
                amount: true,
            },
        });

        const calculatedBalance = aggregations._sum.amount ?? 0;

        // Update master user dengan nilai yang dihitung ulang
        await this.prisma.user.update({
            where: { id: userId },
            data: { quota: calculatedBalance },
        });

        return { calculatedBalance };
    }
}