import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Cron, Timeout } from '@nestjs/schedule';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  
  // Konstanta konversi Troy Ounce ke Gram
  private readonly TROY_OUNCE_TO_GRAM = 31.1034768; 

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 8 * * *')
  async handleDailyUpdate() {
    this.logger.log('Memicu update harga emas harian otomatis...');
    await this.updateGoldPrice();
  }

  /**
   * Mengambil data dari CoinGecko (PAX Gold) - Open Source & Tanpa API Key
   */
  async updateGoldPrice() {
    try {
      this.logger.log('Memulai proses fetching data emas dari CoinGecko (PAXG)...');

      // PAX Gold (PAXG) merepresentasikan 1 troy ounce emas fisik.
      const apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=idr&include_24hr_change=true'; 
      
      const response = await firstValueFrom(
        this.httpService.get(apiUrl) // Tidak memerlukan headers x-access-token
      );

      const rawData = response.data['pax-gold'];
      
      if (!rawData || !rawData.idr) {
        throw new Error('Format respons API tidak valid atau data kosong.');
      }

      // 1. Ekstraksi Harga per Troy Ounce dalam IDR
      const pricePerOunceIDR = rawData.idr;
      const change24hPercent = rawData.idr_24h_change;

      // 2. Kalkulasi Logis (Troy Ounce -> Gram)
      const pricePerGram = pricePerOunceIDR / this.TROY_OUNCE_TO_GRAM;
      const buyPrice = Math.round(pricePerGram); // Pembulatan untuk harga retail
      const sellPrice = Math.round(pricePerGram * 0.95); // Estimasi buyback 95%
      
      // Kalkulasi nominal perubahan (estimasi dari persentase)
      const changeAmount = (pricePerGram * (change24hPercent / 100));

      // 3. Persistensi Data ke Database
      const savedData = await this.prisma.goldPriceHistory.create({
        data: {
          buyPrice: buyPrice,
          sellPrice: sellPrice,
          openPrice: Math.round(pricePerGram - changeAmount), // Estimasi open price
          changeAmount: changeAmount,
          currency: 'IDR',
          unit: 'GRAM',
          source: 'CoinGecko (PAXG/Spot)',
        },
      });

      this.logger.log(`Update berhasil: ID ${savedData.id} - Harga: Rp${buyPrice.toLocaleString()}/gr`);
      return savedData;
    } catch (error) {
      this.logger.error(`Gagal memperbarui harga emas: ${error.message}`);
      // Implementasi fallback atau alert system bisa diletakkan di sini
    }
  }

  @Timeout(5000)
  async testInitialFetch() {
    this.logger.log('Menjalankan testing fetch awal...');
    await this.updateGoldPrice();
  }
}