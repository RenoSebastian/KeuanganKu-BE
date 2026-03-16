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

// Import DTO dan Service Market Settings (Central Bank Config)
import { MarketSettingsService } from './services/market-settings.service';
import { UpdateMarketSettingsDto } from './dto/update-market-settings.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Admin Master Data & Config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
// [PHASE 3 ENHANCEMENT] Standarisasi Prefix Admin
@Controller('admin/master-data')
export class MasterDataController {
    constructor(
        private readonly masterDataService: MasterDataService,
        private readonly marketSettingsService: MarketSettingsService
    ) { }

    // ========================================================================
    // 1. CENTRAL BANK CONFIG (Pengaturan Ekonomi Global)
    // ========================================================================

    @Get('settings')
    @ApiOperation({ summary: 'Mendapatkan pengaturan ekonomi (Inflasi, Bunga, dll) saat ini' })
    // Bisa diakses oleh semua (User/Admin) karena kalkulator butuh angka inflasi
    getMarketSettings() {
        return this.marketSettingsService.getSettings();
    }

    @Patch('settings')
    @Roles(Role.ADMIN) // STRICT RBAC: Hanya Admin yang boleh merubah inflasi
    @ApiOperation({ summary: 'Update pengaturan ekonomi global (Hanya Admin)' })
    updateMarketSettings(
        @GetUser('id') adminId: string,
        @Body() dto: UpdateMarketSettingsDto
    ) {
        return this.marketSettingsService.updateSettings(adminId, dto);
    }

    // ========================================================================
    // 2. UNIT KERJA MANAGEMENT (Agency / Cabang)
    // ========================================================================

    @Get('units')
    @ApiOperation({ summary: 'Daftar Unit Kerja (Agency)' })
    findAllUnits() {
        return this.masterDataService.findAllUnits();
    }

    @Post('units')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Buat Unit Kerja Baru' })
    createUnit(@Body() dto: CreateUnitDto) {
        return this.masterDataService.createUnit(dto);
    }

    @Patch('units/:id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update Unit Kerja' })
    updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
        return this.masterDataService.updateUnit(id, dto);
    }

    @Delete('units/:id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Hapus Unit Kerja' })
    deleteUnit(@Param('id') id: string) {
        return this.masterDataService.deleteUnit(id);
    }
}