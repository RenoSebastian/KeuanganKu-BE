import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { MasterDataService } from './master-data.service';

import { MarketSettingsService } from './services/market-settings.service';
import { UpdateMarketSettingsDto } from './dto/update-market-settings.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Admin Master Data & Config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
// Prefix Utama Controller
@Controller('admin/master-data')
export class MasterDataController {
    constructor(
        private readonly masterDataService: MasterDataService,
        private readonly marketSettingsService: MarketSettingsService
    ) { }

    // ========================================================================
    // 1. CENTRAL BANK CONFIG (Pengaturan Ekonomi Global)
    // Endpoint: /api/admin/master-data/settings
    // ========================================================================

    @Get('settings')
    @ApiOperation({ summary: 'Mendapatkan pengaturan ekonomi (Inflasi, Bunga, dll) saat ini' })
    getMarketSettings() {
        return this.marketSettingsService.getSettings();
    }

    @Patch('settings')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update pengaturan ekonomi global (Hanya Admin)' })
    updateMarketSettings(
        @GetUser('id') adminId: string,
        @Body() dto: UpdateMarketSettingsDto
    ) {
        return this.marketSettingsService.updateSettings(adminId, dto);
    }

    // ========================================================================
    // 2. AGENCY MANAGEMENT (Sebelumnya Unit Kerja)
    // Endpoint: /api/admin/master-data/agencies
    // ========================================================================

    @Get('agencies')
    @ApiOperation({ summary: 'Daftar Agency (Cabang)' })
    findAllUnits() {
        return this.masterDataService.findAllUnits();
    }

    @Post('agencies')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Buat Agency Baru' })
    createUnit(@Body() dto: CreateUnitDto) {
        return this.masterDataService.createUnit(dto);
    }

    @Patch('agencies/:id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update Agency' })
    updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
        return this.masterDataService.updateUnit(id, dto);
    }

    @Delete('agencies/:id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Hapus Agency' })
    deleteUnit(@Param('id') id: string) {
        return this.masterDataService.deleteUnit(id);
    }
}   