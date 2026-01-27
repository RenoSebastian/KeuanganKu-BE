import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private readonly logger = new Logger(SearchService.name);
  private isMeiliHealthy: boolean = false;
  private readonly INDEX_NAME = 'global_search';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.client = new MeiliSearch({
      host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
      apiKey: process.env.MEILI_MASTER_KEY || 'MASTER_KEY_ANDA',
    });

    try {
      this.isMeiliHealthy = await this.client.isHealthy();
      if (this.isMeiliHealthy) {
        this.logger.log('✅ Meilisearch Connected. Hybrid Search Engine Ready.');
        await this.configureMeiliIndex();
      }
    } catch (e) {
      this.logger.error('⚠️ Meilisearch Unreachable. System running on DB-Only mode.');
      this.isMeiliHealthy = false;
    }
  }

  // --- [PHASE 2] CONFIGURATION LOGIC ---
  private async configureMeiliIndex() {
    if (!this.isMeiliHealthy) return;

    try {
      const index = this.client.index(this.INDEX_NAME);

      await index.updateTypoTolerance({
        minWordSizeForTypos: {
          oneTypo: 3,
          twoTypos: 8
        }
      });

      await index.updateSearchableAttributes(['title', 'subtitle']);

      await index.updateRankingRules([
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness'
      ]);

      this.logger.log(`⚙️ Meilisearch Index Configured: Typo Tolerance adjusted (Min 3 chars).`);
    } catch (error) {
      this.logger.error(`❌ Failed to configure Meilisearch index: ${error.message}`);
    }
  }

  // --- UTILITY METHODS ---
  async addDocuments(indexName: string, documents: any[]) {
    if (!this.isMeiliHealthy) return;
    const targetIndex = indexName || this.INDEX_NAME;
    const index = this.client.index(targetIndex);
    return await index.addDocuments(documents);
  }

  // --- [PHASE 4] CORE: ADAPTIVE HYBRID SEARCH ---
  
  async searchEmployees(queryDto: SearchQueryDto, userContext?: any) {
    const { q, limit = 10 } = queryDto; // Default limit 10 jika tidak ada
    const cleanQuery = q?.trim();

    if (!cleanQuery) return [];

    // 1. PRIMARY SEARCH: Meilisearch
    // Kita jalankan dulu engine utama yang paling cepat dan relevan
    const meiliHits = await this.executeMeiliSearch(cleanQuery, limit);

    // 2. CHECK SUFFICIENCY (Optimization)
    // Jika hasil Meili sudah memenuhi limit yang diminta user, STOP.
    // Jangan bebani Database jika tidak perlu.
    if (meiliHits.length >= limit) {
      return meiliHits.slice(0, limit);
    }

    // 3. SECONDARY SEARCH: PostgreSQL Trigram (Gap Filler)
    // Hitung sisa slot yang kosong
    const remainingLimit = limit - meiliHits.length;
    let dbHits: any[] = [];

    if (remainingLimit > 0) {
      this.logger.debug(`🔍 Meili only found ${meiliHits.length} hits. Fetching ${remainingLimit} more from DB...`);
      // Panggil DB hanya dengan limit sisa
      dbHits = await this.executePgTrigramSearch(cleanQuery, remainingLimit);
    }

    // 4. MERGE & DEDUPLICATE (Smart Logic)
    const combinedResults = [...meiliHits];
    // Gunakan Set untuk mencatat ID yang sudah ada di Meili
    const seenIds = new Set(meiliHits.map(item => item.redirectId));
    
    let appendedCount = 0;
    for (const dbHit of dbHits) {
      // Hanya masukkan data DB jika ID-nya belum ada di hasil Meili
      // (Meili menang karena relevansi algoritmanya lebih baik)
      if (!seenIds.has(dbHit.redirectId)) {
        combinedResults.push(dbHit);
        seenIds.add(dbHit.redirectId); 
        appendedCount++;
      }
    }

    if (appendedCount > 0) {
      this.logger.debug(`🧩 Hybrid Merge: Added ${appendedCount} unique hits from Trigram for "${cleanQuery}"`);
    }

    return combinedResults;
  }

  // --- PRIVATE SEARCH EXECUTORS ---

  private async executeMeiliSearch(query: string, limit: number) {
    if (!this.isMeiliHealthy) return [];

    try {
      const index = this.client.index(this.INDEX_NAME);
      const searchResult = await index.search(query, {
        limit: limit, // Gunakan limit sesuai request
        attributesToHighlight: ['title', 'subtitle'],
        showMatchesPosition: true,
      });

      return searchResult.hits.map((hit) => ({
        id: hit.id,
        redirectId: hit.redirectId,
        type: hit.type,
        title: hit._formatted?.title || hit.title,
        subtitle: hit._formatted?.subtitle || hit.subtitle,
        source: 'meilisearch'
      }));
    } catch (error) {
      this.logger.warn(`Meilisearch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * [PHASE 4] Optimized DB Search
   * Sekarang menerima parameter 'limit' dinamis
   */
  private async executePgTrigramSearch(query: string, limit: number) {
    const param = `%${query}%`; 
    const trgmParam = query;     
    // Konversi limit ke integer untuk keamanan
    const limitParam = Math.max(1, Math.floor(limit)); 

    // Query Union dengan Dynamic Limit
    // Kita pasang limit di masing-masing subquery untuk efisiensi scan
    // Lalu kita akan ambil hasil gabungan.
    const sqlQuery = `
      (
        SELECT 
          id::text as "redirectId", 
          full_name as "title", 
          email as "subtitle", 
          'PERSON' as "type"
        FROM users 
        WHERE role = 'USER' 
          AND (
            full_name ILIKE $1 
            OR email ILIKE $1
            OR full_name % $2 
          )
        ORDER BY full_name <-> $2 ASC 
        LIMIT $3 -- Dynamic Limit
      )
      UNION ALL
      (
        SELECT 
          id::text as "redirectId", 
          nama_unit as "title", 
          kode_unit as "subtitle", 
          'UNIT' as "type"
        FROM unit_kerja 
        WHERE 
            nama_unit ILIKE $1 
            OR kode_unit ILIKE $1
            OR nama_unit % $2
        ORDER BY nama_unit <-> $2 ASC
        LIMIT $3 -- Dynamic Limit
      )
    `;

    try {
      // Passing 3 parameter: $1 (LIKE), $2 (Trigram), $3 (Limit)
      const dbResults: any[] = await this.prisma.$queryRawUnsafe(sqlQuery, param, trgmParam, limitParam);

      return dbResults.map(row => ({
        id: `db_${row.type}_${row.redirectId}`,
        redirectId: row.redirectId,
        type: row.type,
        title: row.title, 
        subtitle: row.subtitle,
        source: 'postgres_trigram' 
      }));
    } catch (e) {
      this.logger.error(`Postgres Trigram Search failed: ${e.message}`);
      return [];
    }
  }
}