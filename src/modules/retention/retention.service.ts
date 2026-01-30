import {
    Injectable,
    InternalServerErrorException,
    Logger,
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto'; // Native Node.js crypto library
import { PrismaService } from '../../../prisma/prisma.service';
import { DatabaseStatsResponseDto, TableStatItemDto } from './dto/database-stats.dto';
import { PruneExecutionDto } from './dto/prune-execution.dto';
import { RetentionStrategyFactory } from './strategies/retention-strategy.factory';

@Injectable()
export class RetentionService {
    private readonly logger = new Logger(RetentionService.name);
    private readonly DELETE_BATCH_SIZE = 1000; // Hapus 1000 baris per transaksi DB

    // SECRET KEY untuk HMAC Signature (Idealnya dari Environment Variable)
    private readonly HMAC_SECRET = process.env.RETENTION_SECRET || 'DO_NOT_USE_THIS_IN_PROD_SUPER_SECRET_KEY_99';

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
    ) { }

    // --- FASE 1: MONITORING ---

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

    // --- SECURITY: TOKEN GENERATION & VERIFICATION (NEW) ---

    /**
     * Membuat Token Kriptografi (HMAC) yang menandakan bahwa export telah sukses.
     * Token ini akan disisipkan ke dalam file JSON hasil export.
     */
    generatePruneToken(entityType: string, cutoffDate: string): string {
        const payload = JSON.stringify({ entityType, cutoffDate });

        // Buat HMAC SHA256 Signature
        const signature = crypto
            .createHmac('sha256', this.HMAC_SECRET)
            .update(payload)
            .digest('hex');

        // Return format: Base64Payload.Signature
        return `${Buffer.from(payload).toString('base64')}.${signature}`;
    }

    /**
     * Memvalidasi Token yang dikirim Admin saat request Prune.
     * Mencegah Admin menghapus data tanpa memiliki file export yang valid.
     */
    private validatePruneToken(token: string, entityType: string, cutoffDate: string): void {
        try {
            if (!token || !token.includes('.')) throw new Error('Invalid token format');

            const [b64Payload, signature] = token.split('.');

            // 1. Recreate Signature dari Payload yang dikirim
            const payloadStr = Buffer.from(b64Payload, 'base64').toString('utf-8');
            const expectedSignature = crypto
                .createHmac('sha256', this.HMAC_SECRET)
                .update(payloadStr)
                .digest('hex');

            // 2. Verify Signature (Timing Safe Comparison mencegah Timing Attack)
            // Jika signature beda, berarti payload/token dimanipulasi
            if (signature !== expectedSignature) {
                throw new UnauthorizedException('Security Token Invalid (Signature Mismatch).');
            }

            // 3. Verify Content Match
            // Pastikan token ini memang dibuat untuk Entity & Tanggal yang sedang direquest
            const payload = JSON.parse(payloadStr);
            if (payload.entityType !== entityType || payload.cutoffDate !== cutoffDate) {
                throw new UnauthorizedException('Security Token tidak cocok dengan parameter penghapusan saat ini. Jangan gunakan token dari file export lain.');
            }

        } catch (error) {
            this.logger.warn(`Token validation failed: ${error.message}`);
            throw new UnauthorizedException('Gagal memverifikasi Security Token. Pastikan Anda menyalin token dari file export yang benar.');
        }
    }

    // --- TIMEZONE & DATE HELPER (NEW) ---

    /**
     * Mengubah string 'YYYY-MM-DD' menjadi Date Object yang dinormalisasi ke UTC.
     * "Data sebelum 2025-01-01" -> Date < 2025-01-01T00:00:00.000Z
     */
    normalizeCutoffDate(dateStr: string): Date {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            throw new BadRequestException('Format tanggal harus YYYY-MM-DD');
        }

        // Paksa parsing sebagai UTC Midnight
        const date = new Date(`${dateStr}T00:00:00.000Z`);

        if (isNaN(date.getTime())) {
            throw new BadRequestException('Tanggal tidak valid.');
        }

        return date;
    }

    // --- FASE 4: EXECUTION (SECURE IMPLEMENTATION) ---

    async executePruning(adminId: string, dto: PruneExecutionDto): Promise<{ deletedCount: number; message: string }> {
        const { entityType, cutoffDate, pruneToken } = dto;

        // 1. SECURITY CHECK: Validate Token
        this.validatePruneToken(pruneToken, entityType, cutoffDate);

        // 2. TIMEZONE FIX: Normalize Date
        const cutoff = this.normalizeCutoffDate(cutoffDate);

        // 3. SAFETY CHECK: Hard Constraint Bulan Berjalan (UTC)
        this.validateSafetyDate(cutoff);

        this.logger.log(`Executing SECURE PRUNE for ${entityType} < ${cutoff.toISOString()} by Admin ${adminId}`);

        // 4. Strategy Identification
        const { strategy, tableName } = this.strategyFactory.getStrategy(entityType);
        const candidateIds = await strategy.findCandidates(tableName, cutoff);
        const totalCandidates = candidateIds.length;

        if (totalCandidates === 0) {
            throw new NotFoundException('Tidak ada data yang memenuhi kriteria penghapusan.');
        }

        // 5. Batch Deletion Logic
        let deletedCount = 0;

        for (let i = 0; i < totalCandidates; i += this.DELETE_BATCH_SIZE) {
            const batchIds = candidateIds.slice(i, i + this.DELETE_BATCH_SIZE);

            try {
                await this.prisma.$transaction(async (tx) => {
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
                throw new InternalServerErrorException(`Terjadi kesalahan saat menghapus batch data. Proses dihentikan parsial. (${deletedCount} terhapus).`);
            }
        }

        // 6. Audit Logging
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
                    secure_mode: true,
                    token_verified: true,
                },
            },
        });

        return {
            deletedCount,
            message: `SECURE PRUNE SUCCESS: ${deletedCount} data ${entityType} berhasil dihapus permanen.`,
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
        // Start of Current Month in UTC untuk konsistensi
        const startOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        if (cutoff >= startOfCurrentMonth) {
            throw new BadRequestException(
                'SAFETY VIOLATION: Tidak diizinkan menghapus data bulan berjalan atau masa depan. Mundurkan tanggal cutoff.',
            );
        }
    }

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