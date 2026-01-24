import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Menggunakan Logger bawaan NestJS agar output konsisten dengan system log lainnya
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // [STEP 4: PERFORMANCE GUARD - TEMPORARY]
      // Mengaktifkan logging 'query' untuk inspeksi Raw SQL.
      // Tujuannya: Memastikan fitur Dashboard Direksi tidak memicu N+1 Query.
      // Saat Production, biasanya 'query' dimatikan agar log tidak spam.
      log: ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('DB Connection Established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}