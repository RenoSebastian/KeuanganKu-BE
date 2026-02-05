import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { PrismaModule } from '../../../prisma/prisma.module'; // [FIX] Path relative yang benar

@Module({
  imports: [
    PrismaModule, // Akses ke tabel MarketInsight & GoldPriceHistory
    HttpModule,   // Akses ke API Eksternal (CoinGecko)
  ],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService], // Export agar service ini bisa dipakai di FinancialModule dll
})
export class MarketModule { }