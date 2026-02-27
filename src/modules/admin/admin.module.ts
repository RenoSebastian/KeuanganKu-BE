import { Module } from '@nestjs/common';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { MarketSettingsController } from './controllers/market-settings.controller'; // Yang tadi dibuat
import { AdminDashboardService } from './services/admin-dashboard.service';
import { MasterDataModule } from '../master-data/master-data.module'; // Import jika butuh service lain

@Module({
    imports: [MasterDataModule],
    controllers: [
        AdminDashboardController,
        MarketSettingsController
    ],
    providers: [
        AdminDashboardService
    ],
})
export class AdminModule { }