import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketService } from './market.service';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

@ApiTags('Market Data')
@Controller('market')
@UseInterceptors(LoggingInterceptor)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('gold-price')
  @ApiOperation({ 
    summary: 'Mendapatkan harga emas terbaru',
    description: 'Mengambil data harga emas per gram dalam IDR dari riwayat terbaru di database.' 
  })
  async getGoldPrice() {
    // Memanggil fungsi service yang mengambil data dari tabel GoldPriceHistory
    const latestPrice = await this.marketService.updateGoldPrice();
    
    return {
      success: true,
      data: latestPrice,
      timestamp: new Date().toISOString(),
    };
  }
}