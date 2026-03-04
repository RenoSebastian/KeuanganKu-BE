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
                // Opsional: Jalankan sync saat startup jika perlu
                // await this.syncAllData(); 
            }
        } catch (e) {
            this.logger.warn('⚠️ Meilisearch Unreachable. System running on DB-Only fallback mode.');
            this.isMeiliHealthy = false;
        }
    }

    /**
     * Menambahkan atau Mengupdate dokumen di Meilisearch
     */
    async addDocuments(indexName: string, documents: any[]) {
        // Fail-safe: Jika Meili mati, jangan throw error agar flow aplikasi tetap jalan
        if (!this.isMeiliHealthy) {
            this.logger.warn(`Skipping indexing to ${indexName}: Meilisearch is offline.`);
            return;
        }

        try {
            // Gunakan indexName dari parameter, atau default ke INDEX_NAME
            const targetIndex = indexName || this.INDEX_NAME;
            const index = this.client.index(targetIndex);

            // Execute indexing
            const task = await index.addDocuments(documents);
            this.logger.debug(`AddDocuments Task Enqueued: ${task.taskUid}`);
            return task;
        } catch (error: any) {
            this.logger.error(`Failed to add documents to ${indexName}: ${error.message}`);
        }
    }

    /**
     * Menghapus satu dokumen dari index Meilisearch berdasarkan ID
     */
    async removeDocument(indexName: string, documentId: string) {
        if (!this.isMeiliHealthy) return;

        try {
            const targetIndex = indexName || this.INDEX_NAME;
            const index = this.client.index(targetIndex);

            const task = await index.deleteDocument(documentId);
            this.logger.debug(`RemoveDocument Task Enqueued for ID ${documentId}: ${task.taskUid}`);
            return task;
        } catch (error: any) {
            this.logger.error(`Failed to remove document ${documentId}: ${error.message}`);
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
            await index.updateTypoTolerance({
                minWordSizeForTypos: {
                    oneTypo: 3,
                    twoTypos: 8
                },
                disableOnAttributes: ['redirectId']
            });

            // C. Searchable Fields
            await index.updateSearchableAttributes([
                'title',
                'subtitle',
                'keywords'
            ]);

            // D. Ranking Rules
            await index.updateRankingRules([
                'words',
                'typo',
                'proximity',
                'attribute',
                'sort',
                'exactness'
            ]);

            this.logger.log(`⚙️ Meilisearch Index Configured: Optimized for Fuzzy Search.`);
        } catch (error: any) {
            this.logger.error(`❌ Failed to configure Meilisearch index: ${error.message}`);
        }
    }

    // --- [PHASE 2] CORE: ADAPTIVE HYBRID SEARCH ---

    async searchEmployees(queryDto: SearchQueryDto): Promise<StandardSearchResult[]> {
        const { q, limit = 10 } = queryDto;
        const cleanQuery = q?.replace(/[^\w\s]/gi, '').trim();

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

    private async executeMeiliSearch(query: string, limit: number): Promise<StandardSearchResult[]> {
        if (!this.isMeiliHealthy) return [];

        try {
            const index = this.client.index(this.INDEX_NAME);
            const searchResult = await index.search(query, {
                limit: limit,
                attributesToHighlight: ['title', 'subtitle'],
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
        } catch (error: any) {
            this.logger.warn(`Meilisearch query failed: ${error.message}`);
            return [];
        }
    }

    private async executePgTrigramSearch(query: string, limit: number): Promise<StandardSearchResult[]> {
        const paramLike = `%${query}%`;
        const paramTrgm = query;
        const safeLimit = Math.max(1, Math.floor(limit));

        // [FIXED] Updated raw SQL to match new 'agencies' schema
        const sqlQuery = `
      (
        SELECT 
          id::text as "redirectId", 
          full_name as "title", 
          nip as "subtitle", 
          'PERSON' as "type",
          (full_name <-> $2) as "dist"
        FROM users 
        WHERE 
          full_name ILIKE $1 
          OR nip ILIKE $1
          OR full_name % $2
        ORDER BY "dist" ASC 
        LIMIT $3
      )
      UNION ALL
      (
        SELECT 
          id::text as "redirectId", 
          agency_name as "title", 
          agency_code as "subtitle", 
          'UNIT' as "type",
          (agency_name <-> $2) as "dist"
        FROM agencies 
        WHERE 
          agency_name ILIKE $1 
          OR agency_code ILIKE $1
          OR agency_name % $2
        ORDER BY "dist" ASC
        LIMIT $3
      )
      ORDER BY "dist" ASC
      LIMIT $3;
    `;

        try {
            const dbResults: any[] = await this.prisma.$queryRawUnsafe(
                sqlQuery,
                paramLike,
                paramTrgm,
                safeLimit
            );

            return dbResults.map(row => ({
                id: `db_${row.type}_${row.redirectId}`,
                redirectId: row.redirectId,
                type: row.type,
                title: row.title,
                subtitle: row.subtitle,
                source: 'postgres_trigram',
                score: 1 - (row.dist || 0)
            }));
        } catch (e: any) {
            this.logger.error(`Postgres Trigram Search failed: ${e.message}`);
            return [];
        }
    }

    // --- [PHASE 4] UTILITY: DATA SYNC ---

    async syncAllData() {
        if (!this.isMeiliHealthy) {
            throw new Error("Cannot sync: Meilisearch is offline");
        }

        this.logger.log("🔄 Starting Full Data Sync to Meilisearch...");

        const users = await this.prisma.user.findMany({
            select: { id: true, fullName: true, nip: true, email: true }
        });

        // [FIXED] Updated prisma select for Agency
        const units = await this.prisma.agency.findMany({
            select: { id: true, name: true, code: true }
        });

        const documents = [
            ...users.map(u => ({
                id: u.id,
                redirectId: u.id,
                type: 'PERSON',
                title: u.fullName,
                subtitle: `${u.nip || '-'} • ${u.email}`
            })),
            // [FIXED] Updated mapping for Agency
            ...units.map(uk => ({
                id: uk.id,
                redirectId: uk.id,
                type: 'UNIT',
                title: uk.name,
                subtitle: uk.code
            }))
        ];

        const index = this.client.index(this.INDEX_NAME);
        await index.deleteAllDocuments();
        const task = await index.addDocuments(documents);

        this.logger.log(`✅ Sync Queued. Task UID: ${task.taskUid}. Documents: ${documents.length}`);
        return { status: 'queued', count: documents.length };
    }
}