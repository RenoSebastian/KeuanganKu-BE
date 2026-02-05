import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { SubmitTelemetryDto } from './dto/submit-telemetry.dto';
import { MarketService } from './market.service';

@ApiTags('Market & Telemetry')
@Controller('market')
@UseGuards(JwtAuthGuard, RolesGuard) // Guard Global: Hanya Agen aktif yang bisa akses
@UseInterceptors(LoggingInterceptor) // Logging setiap request
@ApiBearerAuth()
export class MarketController {
  constructor(private readonly marketService: MarketService) { }

  // ===========================================================================
  // 1. TELEMETRY (DATA INSIGHT) - PHASE 4
  // ===========================================================================

  @Post('telemetry')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Kirim Data Telemetri (Insight)',
    description: 'Menyimpan data statistik anonim (Skor, Pekerjaan, Lokasi) untuk analisis pasar. TIDAK BOLEH mengandung data pribadi klien.'
  })
  @ApiResponse({ status: 201, description: 'Insight berhasil disimpan.' })
  async submitTelemetry(
    @GetUser('id') agentId: string,
    @Body() dto: SubmitTelemetryDto,
  ) {
    return this.marketService.saveInsight(agentId, dto);
  }

  // ===========================================================================
  // 2. MARKET DATA (GOLD PRICE)
  // ===========================================================================

  @Get('gold-price')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mendapatkan harga emas terbaru',
    description: 'Mengambil data harga emas per gram dalam IDR dari riwayat terbaru atau External API.'
  })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil harga emas.' })
  async getGoldPrice() {
    // Memanggil service untuk update/get harga emas
    const latestPrice = await this.marketService.updateGoldPrice();

    return {
      success: true,
      data: latestPrice,
      timestamp: new Date().toISOString(),
    };
  }
}