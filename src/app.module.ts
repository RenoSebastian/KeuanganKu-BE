import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

// --- Logging & Config ---
import { winstonConfig } from './common/configs/winston.config';

// --- Global Filters & Interceptors ---
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// --- Feature Modules ---
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FinancialModule } from './modules/financial/financial.module';
import { AuditModule } from './modules/audit/audit.module';
import { MarketModule } from './modules/market/market.module';
import { DirectorModule } from './modules/director/director.module';
import { SearchModule } from './modules/search/search.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { RetentionModule } from './modules/retention/retention.module';
import { EducationModule } from './modules/education/education.module';
import { MediaModule } from './modules/media/media.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    // 1. Global Configurations
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WinstonModule.forRoot(winstonConfig),

    // [PHASE 4] Scheduler untuk Retention Cron Job
    ScheduleModule.forRoot(),

    /**
     * 2. STATIC FILE SERVING [FIXED]
     * Mengizinkan akses publik ke folder uploads.
     * URL: http://host:port/api/uploads/{filename}
     */
    ServeStaticModule.forRoot({
      // [FIX] Gunakan process.cwd() agar aman saat production/build (menunjuk ke root project)
      rootPath: path.join(process.cwd(), 'uploads'),

      // URL Prefix untuk akses file
      serveRoot: 'uploads',

      // [FIX] HAPUS property 'exclude'. 
      // Karena serveRoot sudah spesifik '/api/uploads', ia tidak akan memakan route '/api/auth' dll.
    }),

    // 3. Database
    PrismaModule,

    // 4. Application Features
    AuthModule,
    UsersModule,
    FinancialModule,
    AuditModule,
    MarketModule,
    DirectorModule,
    SearchModule,
    MasterDataModule,
    RetentionModule,
    EducationModule,
    MediaModule,
    SubscriptionModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [
    // Global Error Handling
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Global Request Logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // Global Audit Trail
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule { }