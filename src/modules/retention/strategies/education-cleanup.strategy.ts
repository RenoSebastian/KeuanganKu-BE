import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { MediaStorageService } from '../../media/services/media-storage.service';
import { PruneExecutionDto } from '../dto/prune-execution.dto';
import { EducationModuleStatus } from '@prisma/client';
import { RetentionStrategy } from '../interfaces/retention-strategy.interface';

@Injectable()
export class EducationCleanupStrategy implements RetentionStrategy {
    private readonly logger = new Logger(EducationCleanupStrategy.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mediaService: MediaStorageService,
    ) { }

    /**
     * [ATOMIC STRATEGY]
     * Menggunakan Database Transaction untuk mencegah "Race Condition" (TOCTOU).
     * Memastikan modul tidak dihapus jika ada user yang baru saja mulai mengerjakan (Progress created).
     */
    async execute(cutoffDate: Date, isDryRun: boolean = false): Promise<PruneExecutionDto> {
        this.logger.log(`Executing Atomic Education Retention (DryRun: ${isDryRun}) with cutoff: ${cutoffDate.toISOString()}`);

        const result = new PruneExecutionDto();
        result.entityType = 'EDUCATION_MODULE';
        result.executedAt = new Date();
        result.cutoffDate = cutoffDate.toISOString();
        result.strategyName = 'EducationCleanupStrategy';
        result.pruneToken = isDryRun ? 'DRY_RUN_MODE' : 'EXECUTED';

        try {
            // [STEP 1] Identification Phase (Read-Only / Non-Locking)
            // Mencari kandidat awal untuk mengurangi scope locking nanti
            const staleDraftDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 Hari lalu

            const initialCandidates = await this.prisma.educationModule.findMany({
                where: {
                    OR: [
                        { status: EducationModuleStatus.ARCHIVED, updatedAt: { lte: cutoffDate } },
                        { status: EducationModuleStatus.DRAFT, updatedAt: { lte: staleDraftDate } }
                    ]
                },
                select: { id: true, title: true }
            });

            if (initialCandidates.length === 0) {
                result.recordsDeleted = 0;
                result.status = 'SUCCESS';
                result.message = 'No candidates found.';
                return result;
            }

            // [STEP 2] Atomic Verification & Deletion (Critical Section)
            // Kita bungkus logic 'Check & Delete' dalam satu transaksi
            const transactionResult = await this.prisma.$transaction(async (tx) => {
                const candidateIds = initialCandidates.map(c => c.id);

                // 2a. Re-Check KPI Protection inside Transaction (Locking Logic)
                // Query ini berjalan di dalam transaction scope (tx), sehingga melihat data snapshot yang konsisten
                const activeProgress = await tx.userEducationProgress.findMany({
                    where: { moduleId: { in: candidateIds } },
                    select: { moduleId: true },
                    distinct: ['moduleId']
                });

                const protectedIds = new Set(activeProgress.map(p => p.moduleId));
                const safeToDeleteIds = candidateIds.filter(id => !protectedIds.has(id));

                // Return early jika Dry Run atau tidak ada yang aman dihapus
                if (isDryRun || safeToDeleteIds.length === 0) {
                    return { safeToDeleteIds, count: 0, filesToDelete: [] };
                }

                // 2b. Collect File Paths BEFORE Deletion (DEEP GRAPH FETCHING)
                // Harus merentangkan pencarian ke array sections dan seluruh hierarki kuis
                const modulesToDelete = await tx.educationModule.findMany({
                    where: { id: { in: safeToDeleteIds } },
                    select: {
                        thumbnailUrl: true,
                        sections: {
                            select: { imageUrls: true }
                        },
                        quiz: {
                            select: {
                                questions: {
                                    select: {
                                        imageUrl: true,
                                        options: {
                                            select: { imageUrl: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                const filesToDelete: string[] = [];

                modulesToDelete.forEach(mod => {
                    // 1. Ekstrak Cover/Thumbnail Modul
                    if (mod.thumbnailUrl) filesToDelete.push(mod.thumbnailUrl);

                    // 2. Ekstrak Array Gambar dari setiap Section
                    if (mod.sections) {
                        mod.sections.forEach(sec => {
                            if (sec.imageUrls && sec.imageUrls.length > 0) {
                                filesToDelete.push(...sec.imageUrls);
                            }
                        });
                    }

                    // 3. Ekstrak Gambar dari Pertanyaan dan Opsi Kuis
                    if (mod.quiz && mod.quiz.questions) {
                        mod.quiz.questions.forEach(q => {
                            if (q.imageUrl) filesToDelete.push(q.imageUrl);

                            if (q.options) {
                                q.options.forEach(opt => {
                                    if (opt.imageUrl) filesToDelete.push(opt.imageUrl);
                                });
                            }
                        });
                    }
                });

                // 2c. Execute Hard Delete (DB Level)
                // Karena relasi di schema sudah 'onDelete: Restrict' (sebagai safety net), 
                // operasi ini akan gagal (rollback) jika logic filter di atas tembus (which is good).
                const deleteOp = await tx.educationModule.deleteMany({
                    where: { id: { in: safeToDeleteIds } }
                });

                return { safeToDeleteIds, count: deleteOp.count, filesToDelete };
            }, {
                maxWait: 5000, // Waktu tunggu dapat koneksi pool
                timeout: 15000 // Waktu maksimal transaksi berjalan (DB Lock)
            });

            // [STEP 3] Handle Result & Dry Run Exit
            if (isDryRun) {
                result.recordsDeleted = 0;
                result.recordsToPrune = transactionResult.safeToDeleteIds.length;
                result.status = 'DRY_RUN';
                result.message = `[DRY RUN] Found ${transactionResult.safeToDeleteIds.length} safe modules to prune. Protected ${initialCandidates.length - transactionResult.safeToDeleteIds.length}.`;
                return result;
            }

            // [STEP 4] Return Data for Service-Level File Cleanup
            // Database sudah bersih (Committed). Sekarang kita kembalikan list file
            // agar Service bisa mencatatnya di Log (Idempotency) sebelum menghapus fisik file.

            result.recordsDeleted = transactionResult.count;

            // [PROTOCOL] Kita attach list file ke objek result. 
            // Note: Property '_filesToDelete' tidak ada di DTO standar, 
            // jadi kita cast ke any agar TS tidak complain, atau tambahkan di DTO jika mau proper.
            (result as any)._filesToDelete = transactionResult.filesToDelete;

            result.status = 'SUCCESS';
            result.message = `Successfully deleted ${transactionResult.count} modules from DB. Queued ${transactionResult.filesToDelete?.length || 0} files for cleanup.`;

        } catch (error) {
            this.logger.error(`Atomic Retention Failed: ${error.message}`, error.stack);
            result.recordsDeleted = 0;
            result.status = 'FAILED';
            result.message = `Transaction Rollback: ${error.message}`;
        }

        return result;
    }
}