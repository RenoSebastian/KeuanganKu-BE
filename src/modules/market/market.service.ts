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
   * Mengambil harga emas terbaru dari database dengan mekanisme fallback bertingkat:
   * 1. Dari tabel riwayat goldPriceHistory (paling mutakhir).
   * 2. Jika kosong, dari globalMarketSettings.goldPrice (konfigurasi acuan admin).
   * 3. Jika masih kosong, default nilai aman (Rp 1.350.000).
   */
  async getLatestGoldPrice() {
    try {
      const latestHistory = await this.prisma.goldPriceHistory.findFirst({
        orderBy: { fetchedAt: 'desc' },
      });

      if (latestHistory) {
        return {
          id: latestHistory.id,
          buyPrice: Number(latestHistory.buyPrice),
          sellPrice: Number(latestHistory.sellPrice),
          openPrice: latestHistory.openPrice ? Number(latestHistory.openPrice) : null,
          changeAmount: latestHistory.changeAmount ? Number(latestHistory.changeAmount) : null,
          currency: latestHistory.currency,
          unit: latestHistory.unit,
          source: latestHistory.source,
          fetchedAt: latestHistory.fetchedAt,
        };
      }

      // Fallback 1: Ambil dari GlobalMarketSettings (Admin Configuration)
      const marketSettings = await this.prisma.globalMarketSettings.findFirst();
      const goldPrice = marketSettings ? Number(marketSettings.goldPrice) : 1350000;

      return {
        id: 'settings-fallback',
        buyPrice: goldPrice,
        sellPrice: Math.round(goldPrice * 0.95),
        openPrice: goldPrice,
        changeAmount: 0,
        currency: 'IDR',
        unit: 'GRAM',
        source: 'GlobalMarketSettings',
        fetchedAt: marketSettings?.updatedAt || new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Gagal membaca harga emas dari database: ${error.message}`);
      // Fallback darurat jika database down/error
      return {
        id: 'emergency-fallback',
        buyPrice: 1350000,
        sellPrice: 1282500,
        openPrice: 1350000,
        changeAmount: 0,
        currency: 'IDR',
        unit: 'GRAM',
        source: 'Default Emergency',
        fetchedAt: new Date(),
      };
    }
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
        this.httpService.get(apiUrl, { timeout: 8000 }) // Batasi timeout 8 detik agar tidak hang
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
      return {
        id: savedData.id,
        buyPrice: Number(savedData.buyPrice),
        sellPrice: Number(savedData.sellPrice),
        openPrice: savedData.openPrice ? Number(savedData.openPrice) : null,
        changeAmount: savedData.changeAmount ? Number(savedData.changeAmount) : null,
        currency: savedData.currency,
        unit: savedData.unit,
        source: savedData.source,
        fetchedAt: savedData.fetchedAt,
      };
    } catch (error: any) {
      this.logger.error(`Gagal memperbarui harga emas dari CoinGecko: ${error.message}`);
      // Fallback ke harga terakhir yang tersimpan di database agar caller tidak menerima undefined
      return await this.getLatestGoldPrice();
    }
  }

  @Timeout(5000)
  async testInitialFetch() {
    this.logger.log('Menjalankan testing fetch awal...');
    await this.updateGoldPrice();
  }
}