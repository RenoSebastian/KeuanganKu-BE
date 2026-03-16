import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { ServeStaticModule } from '@nestjs/serve-static';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import * as path from 'path';

// --- Logging & Config ---
import { winstonConfig } from './common/configs/winston.config';
import redisConfig from './common/configs/redis.config';

// --- Global Filters & Interceptors ---
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// --- Guards ---
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';

// --- Middlewares ---
import { ActiveSessionMiddleware } from './common/middleware/active-session.middleware';

// --- Feature Modules ---
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
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
import { EmailModule } from './modules/email/email.module';

// [PHASE 1 FIX] Mengaktifkan AdminModule secara permanen
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // 1. Global Configurations
    ConfigModule.forRoot({
      isGlobal: true,
      load: [redisConfig],
    }),
    WinstonModule.forRoot(winstonConfig),

    // Scheduler
    ScheduleModule.forRoot(),

    // Security: Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Register JwtModule Global for Middleware
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
      global: true,
    }),

    /**
     * 2. STATIC FILE SERVING
     */
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    ServeStaticModule.forRoot({
      rootPath: path.join(process.cwd(), 'public'),
      serveRoot: '/',
    }),

    // 3. Database Layer (PostgreSQL & Redis)
    PrismaModule,
    RedisModule,

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
    EmailModule,

    // [PHASE 1 FIX] Mendaftarkan AdminModule ke Dependency Injection Tree
    AdminModule,
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