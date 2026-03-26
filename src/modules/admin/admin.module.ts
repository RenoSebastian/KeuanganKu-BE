// File: src/modules/admin/admin.module.ts

import { Module } from '@nestjs/common';
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { MarketSettingsController } from './controllers/market-settings.controller';

// Services
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminPdfGeneratorService } from './services/admin-pdf-generator.service';

// Modules
import { MasterDataModule } from '../master-data/master-data.module';
import { AuthModule } from '../auth/auth.module'; // [TAMBAHKAN INI]
import { AuditModule } from '../audit/audit.module'; // [TAMBAHKAN INI] Jika tidak global

@Module({
    imports: [
        MasterDataModule,
        AuthModule,
        AuditModule,
    ],
    controllers: [
        AdminDashboardController,
        MarketSettingsController
    ],
    providers: [
        AdminDashboardService,
        AdminAnalyticsService,
        AdminPdfGeneratorService // [NEW] Mendaftarkan PDF Generator ke DI Container
    ],
    exports: [
        AdminAnalyticsService
    ]
})
export class AdminModule { }