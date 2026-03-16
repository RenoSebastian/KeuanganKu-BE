import {
    Body,
    Controller,
    Get,
    Put,
    UseGuards,
    HttpStatus,
    HttpCode
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import * as client from '@prisma/client';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { MarketSettingsService } from '../../master-data/services/market-settings.service';
import { UpdateMarketSettingsDto } from '../../master-data/dto/update-market-settings.dto';

@Controller('admin/market-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(client.Role.ADMIN) // [FIX] Hapus Role.DIRECTOR karena sudah deprecated
export class MarketSettingsController {
    constructor(private readonly marketSettingsService: MarketSettingsService) { }

    /**
      * [GET] /admin/market-settings
      */
    @Get()
    async getCurrentSettings() {
        // PERBAIKAN: Ubah getCurrentSettings() menjadi getSettings()
        const settings = await this.marketSettingsService.getSettings();
        return {
            message: 'Berhasil mengambil data konfigurasi pasar',
            data: {
                ...settings,
                inflationRate: Number(settings.inflationRate),
                interestRate: Number(settings.interestRate),
                riskFreeRate: Number(settings.riskFreeRate),
                goldPrice: Number(settings.goldPrice),
            },
        };
    }
    // 
    /**
     * [PUT] /admin/market-settings
     * Mengubah konfigurasi pasar.
     * - Validasi input ketat via DTO.
     * - Otomatis mencatat Audit Log via Service.
     */
    @Put()
    @HttpCode(HttpStatus.OK)
    async updateSettings(
        @GetUser() user: client.User,
        @Body() dto: UpdateMarketSettingsDto,
    ) {
        // Service akan menangani update DB + Audit Logging
        const updated = await this.marketSettingsService.updateSettings(user.id, dto);

        return {
            message: 'Konfigurasi pasar berhasil diperbarui',
            data: {
                inflationRate: Number(updated.inflationRate),
                interestRate: Number(updated.interestRate),
                riskFreeRate: Number(updated.riskFreeRate),
                goldPrice: Number(updated.goldPrice),
                updatedAt: updated.updatedAt,
                updatedBy: updated.updatedBy,
            },
        };
    }
}