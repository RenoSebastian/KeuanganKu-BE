import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core'; // [UPDATE] Import APP_GUARD
import { WinstonModule } from 'nest-winston';
import { ServeStaticModule } from '@nestjs/serve-static';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler'; // [NEW] Import Throttler
import * as path from 'path';

// --- Logging & Config ---
import { winstonConfig } from './common/configs/winston.config';
import redisConfig from './common/configs/redis.config'; // [NEW] Import Redis Configuration Namespace

// --- Global Filters & Interceptors ---
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// --- Guards ---
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard'; // [NEW] Custom Guard

// --- Middlewares ---
import { ActiveSessionMiddleware } from './common/middleware/active-session.middleware';

// --- Feature Modules ---
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module'; // [NEW] Import In-Memory Session Layer
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
// import { AdminModule } from './modules/admin/admin.module'; // [OPTIONAL] Uncomment jika AdminModule sudah dibuat di Fase 4

@Module({
  imports: [
    // 1. Global Configurations
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig], // [NEW] Load registrasi konfigurasi namespace 'redis'
    }),
    WinstonModule.forRoot(winstonConfig),

    // Scheduler
    ScheduleModule.forRoot(),

    // [NEW] Security: Rate Limiting (Global Configuration)
    // Limit: 100 request per 60 detik per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 detik (dalam milidetik)
        limit: 100, // Maksimal 100 request
      },
    ]),

    // Register JwtModule Global for Middleware
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        // Perhatian: Ini akan direfaktor di Fase 4 (Auth Service Refactoring) 
        // saat kita memecah masa berlaku antara Access Token dan Refresh Token
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

    // 3. Database Layer (PostgreSQL & Redis)
    PrismaModule,
    RedisModule, // [NEW] Integrasi Redis sebagai state-manager sesi utama

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
    // AdminModule, // Uncomment jika sudah ready
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
    // [NEW] Global Rate Limiting Guard
    // Mengaktifkan Throttler untuk seluruh endpoint secara default
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActiveSessionMiddleware).forRoutes('*');
  }
}