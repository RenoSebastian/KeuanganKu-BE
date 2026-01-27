import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';

// --- Imports Module Existing ---
// Perhatikan: Menggunakan '../' karena folder prisma ada di luar src
import { PrismaModule } from '../prisma/prisma.module'; 
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FinancialModule } from './modules/financial/financial.module';
import { AuditModule } from './modules/audit/audit.module';
import { MarketModule } from './modules/market/market.module';
import { DirectorModule } from './modules/director/director.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { SearchModule } from './modules/search/search.module';

// --- ADDED: Logging Imports ---
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/configs/winston.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    
    // --- Winston Registration ---
    WinstonModule.forRoot(winstonConfig),
    // ----------------------------

    PrismaModule,
    AuthModule,
    UsersModule,
    FinancialModule,
    AuditModule,
    MarketModule,
    DirectorModule,
    SearchModule,
  ],
  controllers: [],
  providers: [
    // Existing Audit Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}