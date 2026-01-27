import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';
import { PrismaService } from '..../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private readonly logger = new Logger(SearchService.name);
  private isMeiliHealthy: boolean = false;

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
      }
    } catch (e) {
      this.logger.error('⚠️ Meilisearch Unreachable. System running on DB-Only mode.');
      this.isMeiliHealthy = false;
    }
  }

  // --- UTILITY METHODS ---
  async addDocuments(indexName: string, documents: any[]) {
    if (!this.isMeiliHealthy) return;
    const index = this.client.index(indexName);
    return await index.addDocuments(documents);
  }

  // --- CORE: HYBRID SCATTER-GATHER SEARCH ---
  
  async searchEmployees(queryDto: SearchQueryDto, userContext?: any) {
    const { q } = queryDto;
    const cleanQuery = q?.trim();

    if (!cleanQuery) return [];

    // 1. SCATTER: Jalankan pencarian Meili dan Postgres secara paralel
    // Kita gunakan allSettled agar jika satu error, yang lain tetap tampil
    const [meiliResults, dbResults] = await Promise.allSettled([
      this.executeMeiliSearch(cleanQuery),
      this.executePgTrigramSearch(cleanQuery)
    ]);

    // 2. GATHER: Ambil hasilnya
    const meiliHits = meiliResults.status === 'fulfilled' ? meiliResults.value : [];
    const dbHits = dbResults.status === 'fulfilled' ? dbResults.value : [];

    // 3. DEDUPLIKASI (Merge Strategy)
    // Priority: Meilisearch (Relevansi lebih baik) > Postgres (Recall lebih baik untuk typo aneh)
    
    const combinedResults = [...meiliHits];
    const seenIds = new Set(meiliHits.map(item => item.redirectId));

    // Masukkan hasil DB hanya jika belum ada di hasil Meili
    let appendedCount = 0;
    for (const dbHit of dbHits) {
      if (!seenIds.has(dbHit.redirectId)) {
        combinedResults.push(dbHit);
        seenIds.add(dbHit.redirectId); // Tandai sudah ada
        appendedCount++;
      }
    }

    if (appendedCount > 0) {
      this.logger.debug(`🧩 Hybrid Merge: Added ${appendedCount} extra hits from Trigram for "${cleanQuery}"`);
    }

    return combinedResults;
  }

  // --- PRIVATE SEARCH EXECUTORS ---

  /**
   * Eksekusi ke Meilisearch (Primary)
   * Menangani typo standar dan relevansi linguistik
   */
  private async executeMeiliSearch(query: string) {
    if (!this.isMeiliHealthy) return [];

    try {
      const index = this.client.index('global_search');
      const searchResult = await index.search(query, {
        limit: 10,
        attributesToHighlight: ['title', 'subtitle'],
        showMatchesPosition: true,
      });

      return searchResult.hits.map((hit) => ({
        id: hit.id,
        redirectId: hit.redirectId,
        type: hit.type,
        title: hit._formatted?.title || hit.title,
        subtitle: hit._formatted?.subtitle || hit.subtitle,
        source: 'meilisearch' // Metadata untuk debugging
      }));
    } catch (error) {
      this.logger.warn(`Meilisearch failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Eksekusi ke PostgreSQL Trigram (Secondary/Supplement)
   * Menangani fragment kata aneh (misal: "rno" -> "Reno")
   */
  private async executePgTrigramSearch(query: string) {
    // Parameter Trigram
    // Kita gunakan operator <-> (Distance) untuk sorting kemiripan
    // Kita gunakan operator % (Similarity) untuk filtering (jika set_limit diatur)
    
    const param = `%${query}%`; // Untuk ILIKE standard
    const trgmParam = query;     // Untuk pg_trgm operators

    // Query Union: Users + Unit Kerja
    // Perhatikan: "ORDER BY ... <-> $2" memaksa hasil paling mirip karakter muncul duluan
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
            OR full_name % $2 -- Trigram Similarity Match
          )
        ORDER BY full_name <-> $2 ASC -- Urutkan berdasarkan jarak text (terdekat = teratas)
        LIMIT 5
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
        LIMIT 5
      )
    `;

    try {
      // Set threshold trigram agar tidak terlalu strict (default 0.3, kita turunkan jika perlu)
      // await this.prisma.$executeRawUnsafe(`SET pg_trgm.similarity_threshold = 0.2;`); 

      const dbResults: any[] = await this.prisma.$queryRawUnsafe(sqlQuery, param, trgmParam);

      return dbResults.map(row => ({
        id: `db_${row.type}_${row.redirectId}`,
        redirectId: row.redirectId,
        type: row.type,
        // DB tidak return <em> highlight, kita kirim raw text
        title: row.title, 
        subtitle: row.subtitle,
        source: 'postgres_trigram' // Metadata: Ini hasil "penyelamatan" DB
      }));
    } catch (e) {
      this.logger.error(`Postgres Trigram Search failed: ${e.message}`);
      return [];
    }
  }
}