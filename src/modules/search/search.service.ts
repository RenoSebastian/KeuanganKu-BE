import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private readonly logger = new Logger(SearchService.name);

  onModuleInit() {
    // Inisialisasi client Meilisearch
    // Menggunakan host default 127.0.0.1:7700 untuk instalasi native
    this.client = new MeiliSearch({
      host: 'http://127.0.0.1:7700',
      apiKey: 'RAHASIA_KITA_123', // Ganti dengan Master Key dari terminal Meilisearch
    });

    this.logger.log('Meilisearch client initialized on http://127.0.0.1:7700');
  }

  /**
   * Mendapatkan instance index tertentu
   */
  getIndex(indexName: string): Index {
    return this.client.index(indexName);
  }

  /**
   * Fungsi wrapper untuk menambahkan dokumen ke index
   */
  async addDocuments(indexName: string, documents: any[]) {
    const index = this.getIndex(indexName);
    return await index.addDocuments(documents);
  }

  /**
   * Fungsi wrapper untuk melakukan pencarian fuzzy
   */
  async search(indexName: string, query: string, options?: any) {
    const index = this.getIndex(indexName);
    return await index.search(query, options);
  }

  /**
   * Health check untuk memastikan server Meilisearch hidup
   */
  async checkHealth() {
    return await this.client.isHealthy();
  }

  /**
   * Logic Bisnis: Pencarian dengan Filter Keamanan
   */
  async searchEmployees(queryDto: SearchQueryDto, user: any) {
    const { q, limit, offset } = queryDto;
    const index = this.getIndex('users');

    // Logical Filter: 
    // Jika user adalah 'MANAGER', dia hanya boleh melihat karyawan di unitKerja yang sama.
    // Jika user adalah 'ADMIN' atau 'DIRECTOR', filter dikosongkan (boleh semua).
    let filter = '';
    if (user.role === 'MANAGER') {
      filter = `unitKerja = "${user.unitKerja}"`;
    }

    return await index.search(q, {
      limit,
      offset,
      filter, // Meilisearch handles this string filter efficiently
      attributesToRetrieve: ['id', 'name', 'unitKerja', 'role', 'email'],
      attributesToHighlight: ['name'], // Berguna untuk UI Next.js nanti
    });
  }
}