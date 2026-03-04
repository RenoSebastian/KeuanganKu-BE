import { Module } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';
import { MarketSettingsService } from './services/market-settings.service';
import { MarketSettingsController } from '../admin/controllers/market-settings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule], // Butuh AuditModule karena MarketSettingsService mencatat log
  controllers: [MasterDataController, MarketSettingsController],
  providers: [MasterDataService, MarketSettingsService],
  exports: [MarketSettingsService], // [PENTING] Harus diekspor agar bisa dipakai FinancialModule
})
export class MasterDataModule { }