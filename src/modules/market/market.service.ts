import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Cron, Timeout } from '@nestjs/schedule';
import { SubmitTelemetryDto } from './dto/submit-telemetry.dto';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  // Konstanta konversi Troy Ounce ke Gram
  private readonly TROY_OUNCE_TO_GRAM = 31.1034768;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) { }

  // ===========================================================================
  // 1. TELEMETRY & INSIGHTS (CORE LOGIC)
  // ===========================================================================

  /**
   * Menyimpan Insight Pasar (Telemetri)
   * Data yang masuk sudah divalidasi oleh DTO, namun kita lakukan sanitasi ekstra
   * untuk memastikan tidak ada PII (Personally Identifiable Information) yang lolos.
   */
  async saveInsight(agentId: string, dto: SubmitTelemetryDto) {
    // 1. Sanitasi Metrics: Hapus key yang berbau identitas dari JSON blob
    const sanitizedMetrics = this.sanitizeMetrics(dto.metrics);

    try {
      // 2. Simpan ke Database (Tabel market_insights)
      const insight = await this.prisma.marketInsight.create({
        data: {
          agentId: agentId,
          moduleType: dto.moduleType,
          occupationCode: dto.occupationCode,
          incomeBracketId: dto.incomeBracketId,
          financialScore: dto.financialScore,
          metrics: sanitizedMetrics, // Simpan JSON yang sudah bersih
          locationLat: dto.latitude,
          locationLong: dto.longitude,
        },
      });

      this.logger.log(
        `Telemetry saved: [${dto.moduleType}] by Agent ${agentId} - ID: ${insight.id}`,
      );

      return {
        success: true,
        message: 'Insight recorded successfully',
        insightId: insight.id.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to save telemetry: ${error.message}`,
        error.stack,
      );
      // Return error yang sopan ke controller
      throw new BadRequestException(
        'Gagal menyimpan data telemetri. Silakan coba lagi.',
      );
    }
  }

  /**
   * Helper: Membersihkan JSON metrics dari potensi data pribadi.
   * Ini adalah lapisan pertahanan terakhir (Defense in Depth).
   */
  private sanitizeMetrics(metrics: Record<string, any>): Record<string, any> {
    if (!metrics) return {};

    // Daftar kata kunci terlarang dalam JSON metrics
    const forbiddenKeys = [
      'name',
      'nama',
      'nik',
      'ktp',
      'email',
      'phone',
      'hp',
      'wa',
      'address',
      'alamat',
    ];

    const clean: Record<string, any> = {};

    for (const [key, value] of Object.entries(metrics)) {
      const lowerKey = key.toLowerCase();
      // Hanya simpan key yang TIDAK mengandung kata terlarang
      if (!forbiddenKeys.some((forbidden) => lowerKey.includes(forbidden))) {
        clean[key] = value;
      }
    }
    return clean;
  }

  // ===========================================================================
  // 2. GOLD PRICE UPDATER (EXISTING FEATURE)
  // ===========================================================================

  @Cron('0 8 * * *') // Jalan setiap jam 8 pagi
  async handleDailyUpdate() {
    this.logger.log('Running daily gold price update...');
    await this.updateGoldPrice();
  }

  /**
   * Mengambil data dari CoinGecko (PAX Gold)
   */
  async updateGoldPrice() {
    try {
      this.logger.log('Fetching gold price from CoinGecko (PAXG)...');

      const apiUrl =
        'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=idr&include_24hr_change=true';

      const response = await firstValueFrom(this.httpService.get(apiUrl));

      const rawData = response.data['pax-gold'];

      if (!rawData || !rawData.idr) {
        throw new Error('Invalid API response format from CoinGecko.');
      }

      // 1. Ekstraksi Harga per Troy Ounce dalam IDR
      const pricePerOunceIDR = rawData.idr;
      const change24hPercent = rawData.idr_24h_change;

      // 2. Kalkulasi Logis (Troy Ounce -> Gram)
      const pricePerGram = pricePerOunceIDR / this.TROY_OUNCE_TO_GRAM;

      // Spread harga (estimasi retail)
      const buyPrice = Math.round(pricePerGram);
      const sellPrice = Math.round(pricePerGram * 0.95); // Buyback 95%

      // Kalkulasi nominal perubahan
      const changeAmount = pricePerGram * (change24hPercent / 100);

      // 3. Persistensi Data
      const savedData = await this.prisma.goldPriceHistory.create({
        data: {
          buyPrice: buyPrice,
          sellPrice: sellPrice,
          openPrice: Math.round(pricePerGram - changeAmount),
          changeAmount: changeAmount,
          currency: 'IDR',
          unit: 'GRAM',
          source: 'CoinGecko (PAXG)',
        },
      });

      this.logger.log(
        `Gold Price Updated: Rp${buyPrice.toLocaleString()}/gr (ID: ${savedData.id})`,
      );
      return savedData;
    } catch (error) {
      this.logger.error(`Failed to update gold price: ${error.message}`);
      // Return null agar controller bisa handle graceful degradation
      return null;
    }
  }

  @Timeout(5000) // Test run saat startup (Development only)
  async testInitialFetch() {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log('Development Mode: Testing initial gold fetch...');
      // await this.updateGoldPrice(); // Uncomment jika ingin test saat start
    }
  }
}