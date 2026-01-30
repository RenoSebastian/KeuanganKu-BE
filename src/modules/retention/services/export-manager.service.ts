import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RetentionStrategyFactory } from '../strategies/retention-strategy.factory';
import { ExportQueryDto } from '../dto/export-query.dto';
import { RetentionService } from '../retention.service';

@Injectable()
export class ExportManagerService {
    private readonly logger = new Logger(ExportManagerService.name);
    private readonly BATCH_SIZE = 1000; // Ukuran chunk data untuk memory safety

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
        private readonly retentionService: RetentionService, // Dependency untuk Security Token & Date normalization
    ) { }

    /**
     * Mengalirkan data arsip langsung ke Client dengan pola "Secure Envelope".
     * Data dibungkus dalam JSON Object yang memiliki Metadata dan Security Token.
     */
    async exportDataStream(query: ExportQueryDto, res: Response): Promise<void> {
        const { entityType, cutoffDate } = query;

        // 1. Timezone Fix: Pastikan tanggal dinormalisasi (UTC Midnight) agar konsisten dengan Prune Logic
        const normalizedDate = this.retentionService.normalizeCutoffDate(cutoffDate);

        this.logger.log(`Starting Secure Export for ${entityType} (Cutoff: ${cutoffDate})`);

        try {
            // 2. Dapatkan Strategi & Nama Tabel
            const { strategy, tableName } = this.strategyFactory.getStrategy(entityType);

            // 3. Identifikasi Kandidat (Query ID saja)
            const candidateIds = await strategy.findCandidates(tableName, normalizedDate);

            if (candidateIds.length === 0) {
                if (!res.headersSent) {
                    this.logger.warn(`No candidates found for ${entityType} before ${cutoffDate}`);
                    throw new NotFoundException('Tidak ada data yang memenuhi kriteria penghapusan.');
                }
                return;
            }

            this.logger.log(`Found ${candidateIds.length} candidates. Starting secure stream...`);

            // 4. Generate Security Token (HMAC)
            // Token ini wajib dikirim balik oleh Admin saat melakukan pruning
            const pruneToken = this.retentionService.generatePruneToken(entityType, cutoffDate);

            // 5. Setup HTTP Headers
            const filename = `secure-archive-${entityType.toLowerCase()}-${cutoffDate}-${new Date().getTime()}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // 6. Start Streaming "Envelope" Structure
            // Kita menulis JSON secara manual string-by-string ke response stream
            res.write(`{
  "metadata": {
    "entityType": "${entityType}",
    "cutoffDate": "${cutoffDate}",
    "totalRecords": ${candidateIds.length},
    "exportedAt": "${new Date().toISOString()}"
  },
  "records": [`); // Membuka Array records

            let isFirstRecord = true;

            // 7. Batch Fetching & Streaming Loop
            for (let i = 0; i < candidateIds.length; i += this.BATCH_SIZE) {
                const batchIds = candidateIds.slice(i, i + this.BATCH_SIZE);

                // Ambil full data
                const records = await this.fetchFullRecords(tableName, batchIds);

                // Tulis record ke stream
                for (const record of records) {
                    if (!isFirstRecord) {
                        res.write(','); // Separator antar object dalam array
                    }
                    res.write(JSON.stringify(record));
                    isFirstRecord = false;
                }

                // Optional: Beri jeda ke Event Loop jika CPU usage tinggi
                await new Promise(resolve => setImmediate(resolve));
            }

            // 8. Close Array & Inject Security Footer
            // Jika stream putus/error sebelum baris ini, JSON akan invalid (kurang '}' penutup)
            // Frontend akan gagal parsing, sehingga Admin tidak bisa mendapatkan Token.
            res.write(`],
  "security": {
    "integrity": "END_OF_STREAM_OK",
    "pruneToken": "${pruneToken}"
  }
}`);

            res.end(); // Selesai.
            this.logger.log(`Secure Export completed successfully for ${filename}`);

        } catch (error) {
            this.handleExportError(error, res);
        }
    }

    /**
     * Mengambil data lengkap (SELECT *) secara aman.
     */
    private async fetchFullRecords(tableName: string, ids: string[]): Promise<any[]> {
        if (ids.length === 0) return [];

        // Parameterisasi ID manual untuk 'IN (...)' clause pada Raw Query
        const idList = ids.map((id) => `'${id}'`).join(',');

        // Validasi nama tabel (whitelist regex) untuk mencegah SQL Injection
        if (!/^[a-z0-9_]+$/i.test(tableName)) {
            throw new InternalServerErrorException('Security Error: Invalid table name format.');
        }

        const query = `SELECT * FROM "${tableName}" WHERE id IN (${idList})`;
        return this.prisma.$queryRawUnsafe(query);
    }

    /**
     * Error Handling khusus Stream.
     * Menangani kondisi jika header sudah terkirim vs belum.
     */
    private handleExportError(error: any, res: Response) {
        this.logger.error(`Export Failed: ${error.message}`, error.stack);

        if (error instanceof NotFoundException) {
            if (!res.headersSent) {
                res.status(404).json({ statusCode: 404, message: error.message });
            }
            return;
        }

        if (!res.headersSent) {
            res.status(500).json({ statusCode: 500, message: 'Internal Server Error during export initialization.' });
        } else {
            // Jika stream sedang berjalan, matikan koneksi.
            // Client akan mendeteksi network error atau JSON tidak valid (terpotong).
            res.end();
        }
    }
}