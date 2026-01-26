import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketService } from './market.service';
import { MarketController } from './market.controller'; // Import Controller baru
import { PrismaModule } from '../../../prisma/prisma.module'; // Import Prisma untuk akses DB

@Module({
  imports: [PrismaModule, HttpModule], // Pastikan PrismaModule terdaftar
  controllers: [MarketController], // Daftarkan MarketController di sini
  providers: [MarketService],
  exports: [MarketService], // Diekspor agar bisa digunakan oleh FinancialModule
})
export class MarketModule {}