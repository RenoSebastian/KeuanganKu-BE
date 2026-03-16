import { Module } from '@nestjs/common';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { MarketSettingsController } from './controllers/market-settings.controller';
import { AdminDashboardService } from './services/admin-dashboard.service';

// Import AdminAnalyticsService yang baru saja dibuat di Fase 2
import { AdminAnalyticsService } from './services/admin-analytics.service';

import { MasterDataModule } from '../master-data/master-data.module';

@Module({
    imports: [
        MasterDataModule
    ],
    controllers: [
        AdminDashboardController,
        MarketSettingsController
    ],
    providers: [
        AdminDashboardService,
        AdminAnalyticsService // Mendaftarkan Sang Engine ke dalam DI Container
    ],
    exports: [
        // Mengekspor AdminAnalyticsService jika sewaktu-waktu module lain 
        // (seperti CronJob Module terpisah) perlu mengakses agregasi data ini
        AdminAnalyticsService
    ]
})
export class AdminModule { }