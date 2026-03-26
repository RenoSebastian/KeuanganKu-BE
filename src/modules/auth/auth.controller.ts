// File: src/modules/auth/auth.controller.ts

import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, VerifyOtpDto, ResendOtpDto } from './dto/auth.dto';

// [NEW IMPORTS] Modul DTO khusus fase Forgot Password (Magic Link)
import { RequestOtpDto as RequestResetDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // ====================================================================
  // [PHASE 1] REGISTER ENDPOINT (Redis-First Entry Point)
  // ====================================================================
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Mendaftarkan agen baru ke memori sementara & Mengirim OTP' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ====================================================================
  // [PHASE 1] VERIFY OTP ENDPOINT (Database Commit & Auto-Login)
  // ====================================================================
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifikasi OTP, terbitkan akun ke Database, dan Auto-Login' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device Fingerprint untuk otorisasi sesi otomatis pasca verifikasi',
    required: true,
  })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Headers('x-device-id') headerDeviceId: string,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    const finalDeviceId = headerDeviceId || dto.deviceId;
    if (!finalDeviceId) {
      throw new BadRequestException('Identitas perangkat (X-Device-ID) tidak ditemukan.');
    }
    dto.deviceId = finalDeviceId;
    return this.authService.verifyOtp(dto, { ipAddress, userAgent });
  }

  // ====================================================================
  // [PHASE 1] RESEND OTP ENDPOINT
  // ====================================================================
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kirim ulang kode OTP ke email pendaftar' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // ====================================================================
  // [PHASE 2] LOGIN INITIATION ENDPOINT (2FA)
  // ====================================================================
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inisiasi masuk (Validasi kredensial & Kirim OTP)' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device Fingerprint untuk keperluan pencetakan sesi nanti',
    required: true,
  })
  login(
    @Body() dto: LoginDto,
    @Headers('x-device-id') headerDeviceId: string,
  ) {
    const finalDeviceId = headerDeviceId || dto.deviceId;
    if (!finalDeviceId) {
      throw new BadRequestException('Identitas perangkat (X-Device-ID) tidak ditemukan.');
    }
    dto.deviceId = finalDeviceId;
    return this.authService.login(dto);
  }

  // ====================================================================
  // [PHASE 3] VERIFY LOGIN OTP ENDPOINT
  // ====================================================================
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifikasi OTP Login dan dapatkan Hybrid JWT Token (AT & RT)' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device Fingerprint untuk Single Session',
    required: true,
  })
  verifyLogin(
    @Body() dto: VerifyOtpDto,
    @Headers('x-device-id') headerDeviceId: string,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    const finalDeviceId = headerDeviceId || dto.deviceId;
    if (!finalDeviceId) {
      throw new BadRequestException('Identitas perangkat (X-Device-ID) tidak ditemukan.');
    }
    dto.deviceId = finalDeviceId;
    return this.authService.verifyLoginOtp(dto, { ipAddress, userAgent });
  }

  // ====================================================================
  // [PHASE 3] RESEND LOGIN OTP ENDPOINT
  // ====================================================================
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('login/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kirim ulang OTP keamanan login ke email agen' })
  resendLoginOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendLoginOtp(dto);
  }

  // ====================================================================
  // ENDPOINT UNTUK SILENT RE-AUTHENTICATION
  // ====================================================================
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotasi Refresh Token untuk mendapatkan Access Token baru' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Harus sama dengan Device ID saat login pertama kali',
    required: true,
  })
  refreshTokens(
    @Body() dto: RefreshTokenDto,
    @Headers('x-device-id') headerDeviceId: string,
  ) {
    const finalDeviceId = headerDeviceId || dto.deviceId;
    if (!finalDeviceId) {
      throw new BadRequestException('Header X-Device-ID wajib disertakan untuk melakukan rotasi token.');
    }
    dto.deviceId = finalDeviceId;
    return this.authService.refreshTokens(dto);
  }

  // ====================================================================
  // [PHASE 4] FORGOT PASSWORD INITIATION (Mencegah User Enumeration)
  // ====================================================================
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meminta pembuatan tautan Magic Link untuk pemulihan kata sandi' })
  async forgotPassword(@Body() dto: RequestResetDto) {
    // Alur OTP dihapus, fungsi ini sekarang memicu pengiriman Magic Link URL
    return this.authService.forgotPassword(dto);
  }

  // ====================================================================
  // [NEW: TAHAP 4 ROADMAP] PRE-FLIGHT CHECK MAGIC LINK URL
  // ====================================================================
  /**
   * Endpoint Read-Only (Aman dari Anti-Spam Bots).
   * Digunakan Frontend saat User pertama kali membuka Magic Link URL dari email, 
   * untuk memastikan tautan belum expired / hangus.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('verify-reset-link')
  @ApiOperation({ summary: 'Memeriksa status validitas token pada Magic Link' })
  @ApiQuery({ name: 'token', description: 'Raw token dari parameter URL', required: true })
  async verifyResetLink(@Query('token') rawToken: string) {
    if (!rawToken) {
      throw new BadRequestException('Token pemulihan tidak ditemukan pada URL.');
    }
    return this.authService.verifyResetTokenHealth(rawToken);
  }

  // ====================================================================
  // [PHASE 5] EXECUTE RESET PASSWORD (Puncak Keamanan)
  // ====================================================================
  /**
   * Mengeksekusi pembuatan kata sandi baru menggunakan token dari URL.
   * Setelah sukses, token di Database dibakar (Burn-on-Write) dan
   * seluruh Active Session di Redis dihancurkan.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ubah kata sandi dan terminasi semua sesi aktif' })
  async resetPassword(
    @Query('token') rawToken: string, // Token dikirim via Query URL, bukan Header Auth
    @Body() dto: ResetPasswordDto
  ) {
    if (!rawToken) {
      throw new BadRequestException('Kredensial keamanan (token) tidak ditemukan pada permintaan ini.');
    }
    return this.authService.resetPasswordByLink(rawToken, dto);
  }
}