import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

// Interface untuk menstandarisasi output dari berbagai sumber (Meili vs DB)
export interface StandardSearchResult {
    id: string; // ID unik untuk frontend key
    redirectId: string; // ID asli database (UUID)
    type: 'AGENT' | 'UNIT';
    title: string; // Nama Agen / Nama Unit
    subtitle: string; // Email / Kode Unit
    description?: string; // Info tambahan (Company / Jabatan)
    source: 'meilisearch' | 'postgres_trigram';
    score?: number; // Skor relevansi
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
            apiKey: process.env.MEILI_API_KEY || 'masterKey',
        });

        // 2. Cek Kesehatan Koneksi
        try {
            this.isMeiliHealthy = await this.client.isHealthy();
            if (this.isMeiliHealthy) {
                this.logger.log(
                    '✅ Meilisearch Connected. Hybrid Search Engine Ready.',
                );
                await this.configureMeiliIndex();
            }
        } catch (e) {
            this.logger.warn(
                '⚠️ Meilisearch Unreachable. System running on DB-Only fallback mode.',
            );
            this.isMeiliHealthy = false;
        }
    }

    // --- PUBLIC API ---

    async addDocuments(indexName: string, documents: any[]) {
        // Fail-safe: Jika Meili mati, jangan throw error agar flow aplikasi tetap jalan
        if (!this.isMeiliHealthy) {
            this.logger.debug(
                `Skipping indexing to ${indexName}: Meilisearch is offline.`,
            );
            return;
        }

        try {
            const targetIndex = indexName || this.INDEX_NAME;
            const index = this.client.index(targetIndex);

            // Execute indexing
            const task = await index.addDocuments(documents);
            this.logger.debug(`AddDocuments Task Enqueued: ${task.taskUid}`);
            return task;
        } catch (error) {
            this.logger.error(
                `Failed to add documents to ${indexName}: ${error.message}`,
            );
        }
    }

    // [NEW] Method untuk menghapus dokumen (Fix error deleteUser)
    async removeDocument(indexName: string, documentId: string) {
        if (!this.isMeiliHealthy) return;

        try {
            const targetIndex = indexName || this.INDEX_NAME;
            const index = this.client.index(targetIndex);

            // Note: Pastikan ID yang dikirim sesuai dengan ID dokumen di Meili
            // Di UsersService biasanya mengirim UUID user. 
            // Jika di sync kita pakai prefix (misal 'user_UUID'), sesuaikan di sini.
            // Untuk implementasi ini kita asumsikan User Service mengirim ID dokumen yang tepat.
            const task = await index.deleteDocument(documentId);
            this.logger.debug(`RemoveDocument Task Enqueued: ${task.taskUid}`);
        } catch (error) {
            this.logger.warn(
                `Error removing document from ${indexName}: ${error.message}`,
            );
        }
    }

    // --- [PHASE 1] CONFIGURATION LOGIC ---
    private async configureMeiliIndex() {
        if (!this.isMeiliHealthy) return;

        try {
            const index: Index = this.client.index(this.INDEX_NAME);

            // A. Primary Key & Filter
            await index.updateFilterableAttributes(['type', 'redirectId']);

            // B. Typo Tolerance
            await index.updateTypoTolerance({
                minWordSizeForTypos: {
                    oneTypo: 3,
                    twoTypos: 8,
                },
                disableOnAttributes: ['redirectId', 'subtitle'], // Jangan typo di Email/ID
            });

            // C. Searchable Fields
            await index.updateSearchableAttributes([
                'title',
                'subtitle',
                'description',
                'company',
            ]);

            // D. Ranking Rules
            await index.updateRankingRules([
                'words',
                'typo',
                'proximity',
                'attribute',
                'sort',
                'exactness',
            ]);

            this.logger.log(
                `⚙️ Meilisearch Index Configured: Optimized for Agent Search.`,
            );
        } catch (error) {
            this.logger.error(
                `❌ Failed to configure Meilisearch index: ${error.message}`,
            );
        }
    }

    // --- [PHASE 2] CORE: ADAPTIVE HYBRID SEARCH ---

    async searchEmployees(
        queryDto: SearchQueryDto,
    ): Promise<StandardSearchResult[]> {
        const { q, limit = 10 } = queryDto;
        // Sanitasi input dasar (allow @ . - for emails)
        const cleanQuery = q?.replace(/[^\w\s@.-]/gi, '').trim();

        if (!cleanQuery) return [];

        // 1. PRIMARY SEARCH: Meilisearch
        const meiliHits = await this.executeMeiliSearch(cleanQuery, limit);

        // 2. CHECK SUFFICIENCY
        if (meiliHits.length >= limit) {
            return meiliHits.slice(0, limit);
        }

        // 3. SECONDARY SEARCH: PostgreSQL Trigram
        const remainingLimit = limit - meiliHits.length;
        let dbHits: StandardSearchResult[] = [];

        if (remainingLimit > 0) {
            dbHits = await this.executePgTrigramSearch(cleanQuery, remainingLimit);
        }

        // 4. MERGE & DEDUPLICATE
        const combinedResults = [...meiliHits];
        const seenIds = new Set(meiliHits.map((item) => item.redirectId));

        for (const dbHit of dbHits) {
            if (!seenIds.has(dbHit.redirectId)) {
                combinedResults.push(dbHit);
                seenIds.add(dbHit.redirectId);
            }
        }

        return combinedResults;
    }

    // --- [PHASE 3] PRIVATE EXECUTORS ---

    private async executeMeiliSearch(
        query: string,
        limit: number,
    ): Promise<StandardSearchResult[]> {
        if (!this.isMeiliHealthy) return [];

        try {
            const index = this.client.index(this.INDEX_NAME);
            const searchResult = await index.search(query, {
                limit: limit,
                attributesToHighlight: ['title', 'subtitle', 'description'],
                showMatchesPosition: true,
            });

            return searchResult.hits.map((hit: any) => ({
                id: hit.id,
                redirectId: hit.redirectId,
                type: hit.type,
                title: hit._formatted?.title || hit.title,
                subtitle: hit._formatted?.subtitle || hit.subtitle,
                description: hit._formatted?.description || hit.description,
                source: 'meilisearch',
            }));
        } catch (error) {
            this.logger.warn(`Meilisearch query failed: ${error.message}`);
            return [];
        }
    }

    private async executePgTrigramSearch(
        query: string,
        limit: number,
    ): Promise<StandardSearchResult[]> {
        const paramLike = `%${query}%`;
        const paramTrgm = query;
        const safeLimit = Math.max(1, Math.floor(limit));

        // Query Union: Cari di Users (Agent) DAN Unit Kerja
        // Updated for New Schema: Users (nama, email, company)
        const sqlQuery = `
      (
        SELECT 
          id::text as "redirectId", 
          nama as "title", 
          email as "subtitle",
          COALESCE(company, '') as "description", 
          'AGENT' as "type",
          (nama <-> $2) as "dist" -- Hitung jarak trigram
        FROM users 
        WHERE 
          nama ILIKE $1 
          OR email ILIKE $1
          OR company ILIKE $1
          OR nama % $2  -- Fuzzy Match Operator
        ORDER BY "dist" ASC 
        LIMIT $3
      )
      UNION ALL
      (
        SELECT 
          id::text as "redirectId", 
          nama_unit as "title", 
          kode_unit as "subtitle", 
          'Unit Kerja' as "description",
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
                safeLimit, // $3
            );

            return dbResults.map((row) => ({
                id: `db_${row.type}_${row.redirectId}`,
                redirectId: row.redirectId,
                type: row.type,
                title: row.title,
                subtitle: row.subtitle,
                description: row.description,
                source: 'postgres_trigram',
                score: 1 - (row.dist || 0),
            }));
        } catch (e) {
            this.logger.error(`Postgres Trigram Search failed: ${e.message}`);
            return [];
        }
    }

    // --- [PHASE 4] UTILITY: DATA SYNC ---

    async syncAllData() {
        if (!this.isMeiliHealthy) {
            throw new Error('Cannot sync: Meilisearch is offline');
        }

        this.logger.log('🔄 Starting Full Data Sync to Meilisearch...');

        // 1. Fetch Users (Updated for Agent Schema)
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                nama: true,
                email: true,
                company: true,
                jabatan: true,
            },
        });

        // 2. Fetch Units
        const units = await this.prisma.unitKerja.findMany({
            select: { id: true, namaUnit: true, kodeUnit: true },
        });

        // 3. Format Documents
        const documents = [
            ...users.map((u) => ({
                id: `user_${u.id}`,
                redirectId: u.id,
                type: 'AGENT',
                title: u.nama,
                subtitle: u.email,
                description: `${u.company || ''} - ${u.jabatan || 'Agen'}`,
                company: u.company,
            })),
            ...units.map((uk) => ({
                id: `unit_${uk.id}`,
                redirectId: uk.id,
                type: 'UNIT',
                title: uk.namaUnit,
                subtitle: uk.kodeUnit,
                description: 'Unit Kerja',
            })),
        ];

        // 4. Upload in Batches
        const index = this.client.index(this.INDEX_NAME);
        await index.deleteAllDocuments(); // Reset index lama
        const task = await index.addDocuments(documents);

        this.logger.log(
            `✅ Sync Queued. Task UID: ${task.taskUid}. Documents: ${documents.length}`,
        );
        return { status: 'queued', count: documents.length };
    }
}