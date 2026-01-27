import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

// Interface untuk menstandarisasi output dari berbagai sumber (Meili vs DB)
export interface StandardSearchResult {
    id: string;        // ID unik untuk frontend key (misal: "meili_user_123")
    redirectId: string;// ID asli database (UUID)
    type: 'PERSON' | 'UNIT';
    title: string;     // Nama Orang / Nama Unit
    subtitle: string;  // NIP / Email / Kode Unit
    source: 'meilisearch' | 'postgres_trigram';
    score?: number;    // Skor relevansi (opsional)
}

@Injectable()
export class SearchService implements OnModuleInit {
    private client: MeiliSearch;
    private readonly logger = new Logger(SearchService.name);
    private isMeiliHealthy: boolean = false;
    private readonly INDEX_NAME = 'global_search';

    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // 1. Inisialisasi Client
        this.client = new MeiliSearch({
            host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
            apiKey: process.env.MEILI_MASTER_KEY || 'RAHASIA_KITA_123',
        });

        // 2. Cek Kesehatan Koneksi
        try {
            this.isMeiliHealthy = await this.client.isHealthy();
            if (this.isMeiliHealthy) {
                this.logger.log('✅ Meilisearch Connected. Hybrid Search Engine Ready.');
                await this.configureMeiliIndex();
                // Opsional: Jalankan sync saat startup jika perlu (hati-hati di production)
                // await this.syncAllData(); 
            }
        } catch (e) {
            this.logger.warn('⚠️ Meilisearch Unreachable. System running on DB-Only fallback mode.');
            this.isMeiliHealthy = false;
        }
    }

    // --- [PHASE 1] CONFIGURATION LOGIC ---
    private async configureMeiliIndex() {
        if (!this.isMeiliHealthy) return;

        try {
            const index: Index = this.client.index(this.INDEX_NAME);

            // A. Primary Key
            await index.updateFilterableAttributes(['type', 'redirectId']);

            // B. Typo Tolerance (Fuzzy Logic Config)
            // "Reno" (4 huruf) -> butuh 1 typo tolerance
            // "Financial" (9 huruf) -> butuh 2 typo tolerance
            await index.updateTypoTolerance({
                minWordSizeForTypos: {
                    oneTypo: 3,
                    twoTypos: 8
                },
                disableOnAttributes: ['redirectId'] // Jangan typo di ID
            });

            // C. Searchable Fields
            await index.updateSearchableAttributes([
                'title',
                'subtitle',
                'keywords' // Opsional: jika ada field hidden keywords
            ]);

            // D. Ranking Rules (Algoritma Relevansi)
            await index.updateRankingRules([
                'words',      // Jumlah kata yang cocok
                'typo',       // Sedikit typo lebih baik
                'proximity',  // Kata yang berdekatan lebih baik
                'attribute',  // Judul lebih penting dari subjudul
                'sort',
                'exactness'
            ]);

            this.logger.log(`⚙️ Meilisearch Index Configured: Optimized for Fuzzy Search.`);
        } catch (error) {
            this.logger.error(`❌ Failed to configure Meilisearch index: ${error.message}`);
        }
    }

    // --- [PHASE 2] CORE: ADAPTIVE HYBRID SEARCH ---

    async searchEmployees(queryDto: SearchQueryDto): Promise<StandardSearchResult[]> {
        const { q, limit = 10 } = queryDto;
        // Sanitasi input dasar
        const cleanQuery = q?.replace(/[^\w\s]/gi, '').trim();

        if (!cleanQuery) return [];

        // 1. PRIMARY SEARCH: Meilisearch
        // Kita jalankan dulu engine utama yang paling cepat
        const meiliHits = await this.executeMeiliSearch(cleanQuery, limit);

        // 2. CHECK SUFFICIENCY (Optimization)
        // Jika hasil Meili sudah memenuhi limit user, STOP. Jangan ganggu DB.
        if (meiliHits.length >= limit) {
            return meiliHits.slice(0, limit);
        }

        // 3. SECONDARY SEARCH: PostgreSQL Trigram (Gap Filler)
        // Hanya cari sisa kekurangannya
        const remainingLimit = limit - meiliHits.length;
        let dbHits: StandardSearchResult[] = [];

        // Trigger DB search hanya jika perlu
        if (remainingLimit > 0) {
            // Log debug jika environment development
            if (process.env.NODE_ENV === 'development') {
                this.logger.debug(`🔍 Meili only found ${meiliHits.length}. Fetching ${remainingLimit} gap-fillers from DB...`);
            }
            dbHits = await this.executePgTrigramSearch(cleanQuery, remainingLimit);
        }

        // 4. MERGE & DEDUPLICATE (Smart Logic)
        const combinedResults = [...meiliHits];

        // Gunakan Set untuk mencatat redirectId yang sudah ada di Meili
        // (Agar data tidak muncul 2x jika ada di Meili DAN di DB)
        const seenIds = new Set(meiliHits.map(item => item.redirectId));

        for (const dbHit of dbHits) {
            if (!seenIds.has(dbHit.redirectId)) {
                combinedResults.push(dbHit);
                seenIds.add(dbHit.redirectId);
            }
        }

        return combinedResults;
    }

    // --- [PHASE 3] PRIVATE EXECUTORS ---

    /**
     * Eksekusi pencarian ke Meilisearch
     */
    private async executeMeiliSearch(query: string, limit: number): Promise<StandardSearchResult[]> {
        if (!this.isMeiliHealthy) return [];

        try {
            const index = this.client.index(this.INDEX_NAME);
            const searchResult = await index.search(query, {
                limit: limit,
                attributesToHighlight: ['title', 'subtitle'], // Untuk UI highlighting nanti
                showMatchesPosition: true,
            });

            return searchResult.hits.map((hit: any) => ({
                id: `meili_${hit.id}`,
                redirectId: hit.redirectId,
                type: hit.type,
                title: hit._formatted?.title || hit.title,
                subtitle: hit._formatted?.subtitle || hit.subtitle,
                source: 'meilisearch'
            }));
        } catch (error) {
            this.logger.warn(`Meilisearch query failed: ${error.message}`);
            return []; // Return kosong agar hybrid logic lanjut ke DB
        }
    }

    /**
     * Eksekusi pencarian ke PostgreSQL menggunakan pg_trgm
     */
    private async executePgTrigramSearch(query: string, limit: number): Promise<StandardSearchResult[]> {
        const paramLike = `%${query}%`;
        const paramTrgm = query;
        // Pastikan limit minimal 1 agar query valid
        const safeLimit = Math.max(1, Math.floor(limit));

        // Query Union: Cari di Users DAN Unit Kerja
        // Menggunakan operator <-> (jarak) untuk sorting kemiripan
        const sqlQuery = `
      (
        SELECT 
          id::text as "redirectId", 
          full_name as "title", 
          nip as "subtitle", 
          'PERSON' as "type",
          (full_name <-> $2) as "dist" -- Hitung jarak trigram
        FROM users 
        WHERE 
          full_name ILIKE $1 
          OR nip ILIKE $1
          OR full_name % $2  -- Fuzzy Match Operator
        ORDER BY "dist" ASC 
        LIMIT $3
      )
      UNION ALL
      (
        SELECT 
          id::text as "redirectId", 
          nama_unit as "title", 
          kode_unit as "subtitle", 
          'UNIT' as "type",
          (nama_unit <-> $2) as "dist"
        FROM unit_kerja 
        WHERE 
          nama_unit ILIKE $1 
          OR kode_unit ILIKE $1
          OR nama_unit % $2
        ORDER BY "dist" ASC
        LIMIT $3
      )
      ORDER BY "dist" ASC
      LIMIT $3;
    `;

        try {
            const dbResults: any[] = await this.prisma.$queryRawUnsafe(
                sqlQuery,
                paramLike, // $1
                paramTrgm, // $2
                safeLimit  // $3
            );

            return dbResults.map(row => ({
                id: `db_${row.type}_${row.redirectId}`,
                redirectId: row.redirectId,
                type: row.type,
                title: row.title,
                subtitle: row.subtitle,
                source: 'postgres_trigram',
                score: 1 - (row.dist || 0) // Konversi jarak (0=mirip) menjadi skor (1=mirip)
            }));
        } catch (e) {
            this.logger.error(`Postgres Trigram Search failed: ${e.message}`);
            return [];
        }
    }

    // --- [PHASE 4] UTILITY: DATA SYNC ---

    /**
     * Helper untuk memasukkan data dari DB ke Meilisearch.
     * Dipanggil manual via endpoint /search/sync atau Scheduler.
     */
    async syncAllData() {
        if (!this.isMeiliHealthy) {
            throw new Error("Cannot sync: Meilisearch is offline");
        }

        this.logger.log("🔄 Starting Full Data Sync to Meilisearch...");

        // 1. Fetch Users
        const users = await this.prisma.user.findMany({
            select: { id: true, fullName: true, nip: true, email: true }
        });

        // 2. Fetch Units
        const units = await this.prisma.unitKerja.findMany({
            select: { id: true, namaUnit: true, kodeUnit: true }
        });

        // 3. Format Documents
        const documents = [
            ...users.map(u => ({
                id: `user_${u.id}`,         // ID dokumen Meili (harus string unik)
                redirectId: u.id,           // ID asli untuk navigasi
                type: 'PERSON',
                title: u.fullName,
                subtitle: `${u.nip} • ${u.email}` // Gabung info untuk pencarian lebih kaya
            })),
            ...units.map(uk => ({
                id: `unit_${uk.id}`,
                redirectId: uk.id,
                type: 'UNIT',
                title: uk.namaUnit,
                subtitle: uk.kodeUnit
            }))
        ];

        // 4. Upload in Batches
        const index = this.client.index(this.INDEX_NAME);
        await index.deleteAllDocuments(); // Reset index lama agar bersih
        const task = await index.addDocuments(documents);

        this.logger.log(`✅ Sync Queued. Task UID: ${task.taskUid}. Documents: ${documents.length}`);
        return { status: 'queued', count: documents.length };
    }
}