import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Logger standar NestJS
  private readonly logger = new Logger(PrismaService.name);
    retentionLog: any;

  constructor() {
    super({
      // Konfigurasi Log
      // 'query': Aktifkan saat debugging raw query retention jika hasilnya aneh.
      // 'error': Wajib nyala untuk production.
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database Connection Established (PostgreSQL)');

      // [OPTIONAL] Hook untuk debugging query lambat
      // this.$on('query' as any, (e: any) => {
      //   if (e.duration > 1000) {
      //     this.logger.warn(`Slow Query detected: ${e.duration}ms - ${e.query}`);
      //   }
      // });

    } catch (error) {
      this.logger.error('Failed to connect to Database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database Connection Closed');
  }

  /**
   * CATATAN ARCHITECT:
   * PrismaClient secara bawaan memiliki method:
   * - $queryRaw<T>: Untuk query yang mengembalikan data (SELECT).
   * - $executeRaw: Untuk query aksi (UPDATE/DELETE) yang mengembalikan jumlah baris.
   * * Kita akan menggunakan $queryRaw di RetentionService untuk mengakses 
   * 'pg_stat_user_tables' guna monitoring size database.
   */
}