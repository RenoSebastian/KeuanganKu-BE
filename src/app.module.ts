import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // [UPDATE] Import ConfigService
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { ServeStaticModule } from '@nestjs/serve-static';
import { JwtModule } from '@nestjs/jwt'; // [UPDATE] Import JwtModule
import * as path from 'path';

// --- Logging & Config ---
import { winstonConfig } from './common/configs/winston.config';

// --- Global Filters & Interceptors ---
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// --- Middlewares ---
import { ActiveSessionMiddleware } from './common/middleware/active-session.middleware';

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

    // Scheduler
    ScheduleModule.forRoot(),

    // [FIX] Register JwtModule Global for Middleware
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
      global: true, // Make it available everywhere including middleware
    }),

    /**
     * 2. STATIC FILE SERVING
     */
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // 3. Database Layer
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
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActiveSessionMiddleware).forRoutes('*');
  }
}