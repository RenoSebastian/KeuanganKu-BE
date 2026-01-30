import {
    Injectable,
    InternalServerErrorException,
    Logger,
    BadRequestException,
    NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DatabaseStatsResponseDto, TableStatItemDto } from './dto/database-stats.dto';
import { PruneExecutionDto } from './dto/prune-execution.dto';
import { RetentionStrategyFactory } from './strategies/retention-strategy.factory';

@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);
    private readonly DELETE_BATCH_SIZE = 1000; // Hapus 1000 baris per transaksi DB

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
    ) { }

    // --- FASE 1: MONITORING (Tetap Ada) ---
    async getDatabaseStats(): Promise<DatabaseStatsResponseDto> {
        try {
            const rawStats = await this.prisma.$queryRaw<any[]>`
        SELECT 
          relname as "tableName", 
          n_live_tup as "rowCount", 
          pg_total_relation_size(relid) as "totalBytes",
          pg_indexes_size(relid) as "indexBytes"
        FROM pg_stat_user_tables 
        ORDER BY pg_total_relation_size(relid) DESC;
      `;

            const stats: TableStatItemDto[] = rawStats.map((row) => ({
                tableName: row.tableName,
                rowCount: Number(row.rowCount),
                totalBytes: Number(row.totalBytes),
                formattedSize: this.formatBytes(Number(row.totalBytes)),
                indexBytes: Number(row.indexBytes),
            }));

            const totalSize = stats.reduce((acc, curr) => acc + curr.totalBytes, 0);

            return {
                tables: stats,
                totalDatabaseSize: totalSize,
                formattedTotalSize: this.formatBytes(totalSize),
            };
        } catch (error) {
            this.logger.error('Failed to fetch database stats', error.stack);
            throw new InternalServerErrorException('Gagal mengambil statistik database.');
        }
    }

    // --- FASE 4: EXECUTION (New Implementation) ---

    /**
     * Eksekusi pemusnahan data secara aman dan tercatat.
     * Logic:
     * 1. Validasi "Safety Date" (Tidak boleh hapus bulan berjalan).
     * 2. Identifikasi kandidat hapus via Strategy.
     * 3. Loop Batch Delete (untuk menghindari DB Lock).
     * 4. Catat Audit Log.
     */
    async executePruning(adminId: string, dto: PruneExecutionDto): Promise<{ deletedCount: number; message: string }> {
        const { entityType, cutoffDate } = dto;
        const cutoff = new Date(cutoffDate);

        // 1. SAFETY CHECK: Hard Constraint Bulan Berjalan
        this.validateSafetyDate(cutoff);

        this.logger.log(`Starting Pruning Execution for ${entityType} (Cutoff: ${cutoffDate}) by Admin ${adminId}`);

        // 2. Strategy Identification
        const { strategy, tableName } = this.strategyFactory.getStrategy(entityType);
        const candidateIds = await strategy.findCandidates(tableName, cutoff);
        const totalCandidates = candidateIds.length;

        if (totalCandidates === 0) {
            throw new NotFoundException('Tidak ada data yang memenuhi kriteria penghapusan.');
        }

        // 3. Batch Deletion Logic
        let deletedCount = 0;

        // Kita proses penghapusan dalam loop batch
        for (let i = 0; i < totalCandidates; i += this.DELETE_BATCH_SIZE) {
            const batchIds = candidateIds.slice(i, i + this.DELETE_BATCH_SIZE);

            try {
                // Transactional Batch Delete
                // Kita gunakan $transaction agar jika batch ini gagal, 1000 data ini rollback
                await this.prisma.$transaction(async (tx) => {
                    // Gunakan deleteMany dengan ID list.
                    // Prisma otomatis men-generate query: DELETE FROM table WHERE id IN (...)
                    // Kita perlu casting dynamic table access karena TypeScript Prisma client statis
                    const delegate = (tx as any)[this.mapEntityToDelegate(entityType)];

                    if (!delegate) {
                        throw new Error(`Prisma Delegate not found for entity ${entityType}`);
                    }

                    await delegate.deleteMany({
                        where: { id: { in: batchIds } },
                    });
                });

                deletedCount += batchIds.length;
                this.logger.log(`Batch prune success: ${deletedCount}/${totalCandidates} rows.`);

            } catch (error) {
                this.logger.error(`Batch Pruning Failed at index ${i}: ${error.message}`);
                // Kita stop proses jika ada error kritis, tapi data yg SUDAH terhapus di batch sebelumnya tetap terhapus (Committed).
                // Ini lebih aman daripada rollback 100.000 data sekaligus yang bikin DB crash.
                throw new InternalServerErrorException(`Terjadi kesalahan saat menghapus batch data. Proses dihentikan parsial. (${deletedCount} terhapus).`);
            }
        }

        // 4. Audit Logging (Bukti Hukum)
        await this.prisma.retentionLog.create({
            data: {
                executorId: adminId,
                entityType: entityType,
                action: 'PRUNE',
                recordsDeleted: deletedCount,
                cutoffDate: cutoff,
                metadata: {
                    strategy: strategy.constructor.name,
                    tableName: tableName,
                    requestedAt: new Date(),
                },
            },
        });

        // Optional: Trigger Vacuum (PostgreSQL Maintenance) bisa ditaruh di sini via Job Queue terpisah

        return {
            deletedCount,
            message: `Berhasil menghapus ${deletedCount} data arsip ${entityType}. Log aktivitas telah disimpan.`,
        };
    }

    // --- HELPER METHODS ---

    private formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals < 0 ? 0 : decimals)) + ' ' + sizes[i];
    }

    private validateSafetyDate(cutoff: Date) {
        const now = new Date();
        // Set ke awal bulan ini (tanggal 1, jam 00:00)
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        if (cutoff >= startOfCurrentMonth) {
            throw new BadRequestException(
                'PELANGGARAN SAFETY: Anda tidak diperbolehkan menghapus data bulan berjalan atau masa depan. Mundurkan tanggal cutoff.',
            );
        }
    }

    // Mapper string entityType ke nama property Prisma Client (camelCase)
    // e.g. FINANCIAL_CHECKUP -> financialCheckup
    private mapEntityToDelegate(entityType: string): string {
        switch (entityType) {
            case 'FINANCIAL_CHECKUP': return 'financialCheckup';
            case 'PENSION': return 'pensionPlan';
            case 'GOAL': return 'goalPlan';
            case 'BUDGET': return 'budgetPlan';
            case 'INSURANCE': return 'insurancePlan';
            default: throw new Error('Unknown Entity Delegate');
        }
    }
}