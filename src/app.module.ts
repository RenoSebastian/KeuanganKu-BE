import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module'; // Import ini
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FinancialModule } from './modules/financial/financial.module';
import { AuditModule } from './modules/audit/audit.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    FinancialModule,
    AuditModule, // Masukkan ini
  ],
  controllers: [],
  providers: 
  [ 
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}