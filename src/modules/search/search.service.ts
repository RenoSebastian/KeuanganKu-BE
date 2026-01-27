import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private readonly logger = new Logger(SearchService.name);
  private isMeiliHealthy: boolean = false;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Inisialisasi Client Meilisearch
    this.client = new MeiliSearch({
      host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
      apiKey: process.env.MEILI_MASTER_KEY || 'MASTER_KEY_ANDA', // Pastikan sama dengan .env
    });

    // Cek koneksi awal
    try {
      this.isMeiliHealthy = await this.client.isHealthy();
      if (this.isMeiliHealthy) {
        this.logger.log('✅ Meilisearch Connected. Ready for Unified Search.');
      }
    } catch (e) {
      this.logger.error('❌ Meilisearch Connection Failed. Using Database Fallback.');
      this.isMeiliHealthy = false;
    }
  }

  /**
   * GLOBAL OMNI SEARCH
   * Mencari User DAN Unit Kerja sekaligus.
   * Mengembalikan format standar: { title, subtitle, type, redirectId }
   */
  async searchEmployees(queryDto: SearchQueryDto, userContext?: any) {
    const { q } = queryDto;
    const cleanQuery = q.trim();

    if (!cleanQuery) return [];

    // ---------------------------------------------------------
    // STRATEGI 1: MEILISEARCH (Primary - Ultra Fast & Typo Tolerant)
    // ---------------------------------------------------------
    if (this.isMeiliHealthy) {
      try {
        const index = this.client.index('global_search'); // Menggunakan index gabungan

        const searchResult = await index.search(cleanQuery, {
          limit: 10,
          attributesToHighlight: ['title', 'subtitle'],
          showMatchesPosition: true,
          // Filter logic (Opsional): Jika Manager hanya boleh cari Person di unitnya
          // filter: userContext?.role === 'MANAGER' ? `tag = "${userContext.unitKerjaId}" OR type = "UNIT"` : undefined
        });

        if (searchResult.hits.length > 0) {
          return searchResult.hits.map((hit) => ({
            id: hit.id, // ID Unik Meili (user_123)
            redirectId: hit.redirectId, // ID Asli UUID (untuk routing)
            type: hit.type, // 'PERSON' | 'UNIT'
            
            // Highlight Logic: Gunakan teks ber-highlight jika ada, jika tidak pakai plain text
            title: hit._formatted?.title || hit.title, 
            subtitle: hit._formatted?.subtitle || hit.subtitle, 
            
            source: 'meilisearch'
          }));
        }
      } catch (error) {
        this.logger.warn(`⚠️ Meilisearch error: ${error.message}. Switching to SQL Fallback.`);
        // Jangan throw error, lanjut ke Fallback DB
      }
    }

    // ---------------------------------------------------------
    // STRATEGI 2: POSTGRESQL (Fallback - Reliable)
    // ---------------------------------------------------------
    return await this.searchFallbackDb(cleanQuery);
  }

  /**
   * FALLBACK DATABASE QUERY
   * Menggunakan UNION untuk mencari di tabel User dan UnitKerja secara bersamaan
   */
  private async searchFallbackDb(query: string) {
    this.logger.log(`🔄 Executing DB Fallback for: ${query}`);
    const param = `%${query}%`;

    // Query Union: Cari User (atas) gabung dengan Cari Unit (bawah)
    const sqlQuery = `
      (
        SELECT 
          id::text as "redirectId", 
          full_name as "title", 
          email as "subtitle", 
          'PERSON' as "type"
        FROM users 
        WHERE full_name ILIKE $1 OR email ILIKE $1
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
        WHERE nama_unit ILIKE $1 OR kode_unit ILIKE $1
        LIMIT 5
      )
    `;

    try {
      const dbResults: any[] = await this.prisma.$queryRawUnsafe(sqlQuery, param);

      return dbResults.map(row => ({
        id: `db_${row.type}_${row.redirectId}`, // Fake ID untuk key React
        redirectId: row.redirectId,
        type: row.type,
        title: row.title, // Di DB tidak ada highlight otomatis
        subtitle: row.subtitle,
        source: 'database'
      }));
    } catch (e) {
      this.logger.error(`❌ DB Fallback failed: ${e.message}`);
      return [];
    }
  }

  async addDocuments(indexName: string, documents: any[]) {
    if (!this.isMeiliHealthy) {
      this.logger.warn(`Skipping indexing to '${indexName}' because Meilisearch is down.`);
      return;
    }

    try {
      const index = this.client.index(indexName);
      const task = await index.addDocuments(documents);
      this.logger.log(`Document added to ${indexName}. TaskUid: ${task.taskUid}`);
      return task;
    } catch (error) {
      this.logger.error(`Failed to add documents to ${indexName}: ${error.message}`);
      // Tidak throw error agar flow utama DirectorService tidak putus
    }
  }

  // --- Utility Methods ---
  
  async checkHealth() {
    try {
      return await this.client.isHealthy();
    } catch (e) {
      return false;
    }
  }
}