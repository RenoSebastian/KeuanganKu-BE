import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { ServeStaticModule } from '@nestjs/serve-static'; // [NEW] Import
import * as path from 'path';

// --- Logging & Config ---
import { winstonConfig } from './common/configs/winston.config';

// --- Modules ---
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
import { MediaModule } from './modules/media/media.module'; // [NEW] Import

// --- Interceptors ---
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    WinstonModule.forRoot(winstonConfig),

    // [NEW] Serve Static Files (Public Folder)
    // Ini membuat folder './public' bisa diakses di root URL.
    // Contoh: file './public/uploads/img.jpg' -> 'http://localhost:3000/uploads/img.jpg'
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'public'), // Mundur 1 step dari /dist/src ke /public
      serveRoot: '/',
    }),

    // Core Database Module
    PrismaModule,

    // Feature Modules
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
    MediaModule, // [NEW] Registration
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule { }