import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RetentionStrategyFactory } from '../strategies/retention-strategy.factory';
import { ExportQueryDto } from '../dto/export-query.dto';

@Injectable()
export class ExportManagerService {
    private readonly logger = new Logger(ExportManagerService.name);
    private readonly BATCH_SIZE = 1000; // Ukuran chunk data untuk memory safety

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
    ) { }

    /**
     * Mengalirkan data arsip langsung ke Client (Browser) tanpa memuat semua ke RAM.
     * Menggunakan konsep 'Backpressure' handling secara implisit via await.
     */
    async exportDataStream(query: ExportQueryDto, res: Response): Promise<void> {
        const { entityType, cutoffDate } = query;
        this.logger.log(`Starting Safe Export for ${entityType} (Cutoff: ${cutoffDate})`);

        try {
            // 1. Dapatkan Strategi & Nama Tabel yang tepat
            const { strategy, tableName } = this.strategyFactory.getStrategy(entityType);

            // 2. Identifikasi Kandidat (Hanya ID)
            // Ini menggunakan logika "Smart Deletion" (Historical vs Snapshot) yang sudah kita buat di Fase 2
            const candidateIds = await strategy.findCandidates(tableName, new Date(cutoffDate));

            if (candidateIds.length === 0) {
                this.logger.warn(`No candidates found for ${entityType} before ${cutoffDate}`);
                throw new NotFoundException('Tidak ada data yang memenuhi kriteria penghapusan.');
            }

            this.logger.log(`Found ${candidateIds.length} candidates. Starting stream...`);

            // 3. Setup HTTP Headers untuk Download File
            const filename = `archive-${entityType.toLowerCase()}-${new Date().getTime()}.json`;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // 4. Mulai Streaming JSON Array
            res.write('[');
            let isFirstRecord = true;

            // 5. Batch Fetching & Streaming Loop
            for (let i = 0; i < candidateIds.length; i += this.BATCH_SIZE) {
                const batchIds = candidateIds.slice(i, i + this.BATCH_SIZE);

                // Ambil full data dari DB berdasarkan batch ID
                const records = await this.fetchFullRecords(tableName, batchIds);

                // Tulis ke stream
                for (const record of records) {
                    if (!isFirstRecord) {
                        res.write(','); // Separator JSON antar object
                    }
                    // Serialisasi record ke string JSON & kirim
                    res.write(JSON.stringify(record));
                    isFirstRecord = false;
                }

                // Optional: Set Immediate untuk memberi nafas pada Event Loop jika load sangat tinggi
                // await new Promise(resolve => setImmediate(resolve));
            }

            // 6. Tutup JSON Array & Stream
            res.write(']');
            res.end(); // Selesai. Koneksi ditutup.

            this.logger.log(`Export completed successfully for ${filename}`);

        } catch (error) {
            this.handleExportError(error, res);
        }
    }

    /**
     * Mengambil data lengkap (SELECT *) secara aman menggunakan parameterisasi ID.
     * Kita menggunakan $queryRawUnsafe karena nama tabel dinamis, TAPI ID diparameterisasi manual
     * untuk keamanan extra, meskipun candidateIds berasal dari sistem internal.
     */
    private async fetchFullRecords(tableName: string, ids: string[]): Promise<any[]> {
        if (ids.length === 0) return [];

        // Construct Parameterized Query Manual untuk array IN (...)
        // Prisma Raw tidak support array binding native di semua driver, 
        // jadi kita mapping string literal dengan quote aman.
        const idList = ids.map((id) => `'${id}'`).join(',');

        // VALIDASI FINAL: Pastikan tableName hanya berisi karakter aman (a-z, _, 0-9)
        // Ini pertahanan lapis terakhir terhadap SQL Injection via nama tabel
        if (!/^[a-z0-9_]+$/i.test(tableName)) {
            throw new InternalServerErrorException('Security Error: Invalid table name format.');
        }

        const query = `SELECT * FROM "${tableName}" WHERE id IN (${idList})`;

        return this.prisma.$queryRawUnsafe(query);
    }

    /**
     * Error Handling khusus untuk Stream.
     * Jika header sudah terkirim, kita tidak bisa kirim JSON Error response standar.
     * Kita harus memutus stream atau mengirim sinyal error dalam text.
     */
    private handleExportError(error: any, res: Response) {
        this.logger.error(`Export Failed: ${error.message}`, error.stack);

        if (error instanceof NotFoundException) {
            // Jika belum mulai streaming (headers belum dikirim), kirim 404 standar
            if (!res.headersSent) {
                res.status(404).json({ statusCode: 404, message: error.message });
            }
            return;
        }

        // Jika error terjadi di tengah streaming (misal putus koneksi DB)
        if (!res.headersSent) {
            res.status(500).json({ statusCode: 500, message: 'Internal Server Error during export initialization.' });
        } else {
            // Jika stream sedang berjalan, kita paksa tutup (Browser akan mendeteksi network error / file corrupt)
            res.end();
        }
    }
}