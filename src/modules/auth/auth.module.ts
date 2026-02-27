import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { NotificationModule } from '../notification/notification.module'; // [NEW] Import modul notifikasi

@Module({
  imports: [
    JwtModule.register({}), // Setup JWT Kosong dulu, config diambil di Service

    // [NEW] Daftarkan NotificationModule agar AuthService dapat 
    // mengakses NotificationGateway untuk menendang sesi (Kick-out).
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule { }