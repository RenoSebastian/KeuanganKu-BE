import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { NotificationModule } from '../notification/notification.module'; // [NEW] Import modul notifikasi
import { EmailModule } from '../email/email.module'; // [NEW] Import modul Email Independen

@Module({
  imports: [
    JwtModule.register({}), // Setup JWT Kosong dulu, config diambil di Service

    // Daftarkan NotificationModule agar AuthService dapat 
    // mengakses NotificationGateway untuk menendang sesi (Kick-out).
    NotificationModule,

    // [NEW] Mendaftarkan EmailModule untuk kapabilitas pengiriman email transaksional
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule { }