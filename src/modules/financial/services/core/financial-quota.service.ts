import {
    Injectable,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { NotificationService } from '../../../notification/notification.service';
import { NotificationType, NotificationCategory, Prisma } from '@prisma/client';

@Injectable()
export class FinancialQuotaService {
    private readonly logger = new Logger(FinancialQuotaService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Core Logic: Validasi Akses & Potong Kuota
     * [UPDATED - Step 3 & 4] Mendukung Transaction Propagation (txContext) dan Module Type Idempotency.
     */
    async validateAndDeductQuota(
        userId: string,
        sessionId: string,
        moduleType: string, // Step 4: Pencegahan eksploitasi token antar modul
        txContext?: Prisma.TransactionClient // Step 3: Menerima konteks transaksi dari luar
    ): Promise<boolean> {

        // Gunakan transaksi bawaan jika dikirim, atau gunakan instance prisma utama
        const db = txContext || this.prisma;

        // 1. Cek Status PRO (Unlimited Pass)
        const subscription = await db.userSubscription.findUnique({
            where: { userId },
        });

        if (subscription && subscription.status === 'ACTIVE') {
            return true; // Bypass untuk User PRO
        }

        // 2. Cek Riwayat Session (Idempotency Check - Revisi Gratis)
        // [FIXED] Menambahkan moduleType agar session Checkup tidak bisa dipakai untuk Budgeting
        const existingSession = await db.simulationLog.findFirst({
            where: {
                agentId: userId,
                sessionId: sessionId,
                moduleType: moduleType,
            },
        });

        if (existingSession) {
            return true; // Revisi Gratis (Sudah pernah bayar untuk sesi modul ini)
        }

        // 3. Logic Token untuk User FREE
        // Fungsi helper untuk mengeksekusi logika kuota (agar bisa dipakai dengan/tanpa txContext luar)
        const executeTokenDeduction = async (tx: Prisma.TransactionClient) => {
            let usage = await tx.userUsage.findUnique({
                where: { userId },
            });

            // Handle jika user belum punya record usage (Edge Case/New User)
            if (!usage) {
                usage = await tx.userUsage.create({
                    data: { userId, simulationQuota: 10, totalUsed: 0 },
                });
            }

            if (usage.simulationQuota <= 0) {
                throw new ForbiddenException(
                    'Kuota simulasi gratis Anda telah habis. Silakan Upgrade ke PRO untuk akses tanpa batas.',
                );
            }

            // Potong 1 Token
            const updatedUsage = await tx.userUsage.update({
                where: { userId },
                data: {
                    simulationQuota: { decrement: 1 },
                    totalUsed: { increment: 1 },
                },
            });

            // [STEP 4: FIXED] Catat transaksi ini ke Buku Besar (Ledger) untuk Akuntansi & Audit
            await tx.userQuotaLedger.create({
                data: {
                    userId,
                    amount: -1,
                    type: 'USAGE_SIMULATION',
                    referenceId: sessionId,
                    balanceAfter: updatedUsage.simulationQuota,
                    description: `Pemotongan kuota untuk simulasi modul ${moduleType}`,
                }
            });

            // 4. Trigger Notifikasi jika kuota menipis (Sisa 1)
            if (updatedUsage.simulationQuota === 1) {
                // Fire-and-forget notification agar tidak memblokir response
                setImmediate(() => {
                    this.notificationService
                        .createAndSend({
                            userId,
                            title: 'Kuota Hampir Habis ⚠️',
                            message: 'Perhatian! Kuota simulasi gratis Anda tinggal 1 token lagi. Segera upgrade ke PRO untuk layanan tanpa batas.',
                            type: NotificationType.WARNING,
                            category: NotificationCategory.QUOTA,
                        })
                        .catch((e) =>
                            this.logger.error('Failed sending quota warning', e),
                        );
                });
            }

            return true;
        };

        // Delegasi Eksekusi
        if (txContext) {
            // Jika sudah berada dalam transaksi gabungan (dari CalculatorService), jalankan langsung
            return executeTokenDeduction(txContext);
        } else {
            // Jika dipanggil secara terisolasi, buat transaksi baru (Fallback)
            return this.prisma.$transaction(executeTokenDeduction);
        }
    }
}