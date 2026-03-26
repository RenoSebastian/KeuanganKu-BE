import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  BadRequestException,
  UseGuards,
  Req
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, VerifyOtpDto, ResendOtpDto } from './dto/auth.dto';

// [NEW IMPORTS] Modul DTO khusus fase Forgot Password
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyForgotPasswordOtpDto as VerifyPasswordOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { ApiTags, ApiOperation, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PasswordResetScopeGuard } from './guards/scoped-jwt.guard';

@ApiTags('Auth') // Label di Swagger
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // ====================================================================
  // [PHASE 1] REGISTER ENDPOINT (Redis-First Entry Point)
  // ====================================================================
  /**
   * Pendaftaran Agen Asuransi (Tahap 1)
   * Dilindungi limitasi 3 request per menit untuk mencegah spam SMTP 
   * dan eksploitasi memori Redis dari IP yang sama.
   */
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Mendaftarkan agen baru ke memori sementara & Mengirim OTP' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ====================================================================
  // [PHASE 1] VERIFY OTP ENDPOINT (Database Commit & Auto-Login)
  // ====================================================================
  /**
   * Verifikasi OTP (Tahap 2)
   * Limitasi 5 percobaan per menit. Sangat krusial untuk mencegah serangan
   * Brute-Force (menebak 6 digit angka secara berulang).
   */
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
  /**
   * * [STRATEGY] Tidak lagi mencetak JWT langsung.
   * Hanya memvalidasi DB, membuat OTP, menyimpannya di Redis, dan menembak SMTP.
   * Limit 5 percobaan per 5 menit untuk mencegah eksploitasi fitur Lupa Sandi gaya baru.
   */
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
  /**
   * Limitasi ketat 5x per menit agar hacker yang berhasil mencuri password
   * tidak bisa melakukan brute-force kode OTP yang masuk ke email asli.
   */
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
  /**
   * Limitasi ketat: 3 request per 5 menit untuk mencegah eksploitasi SMTP
   * dan Brute-Force pencarian email.
   */
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meminta OTP untuk pemulihan kata sandi' })
  async forgotPassword(@Body() dto: RequestOtpDto) {
    return this.authService.forgotPassword(dto);
  }

  // ====================================================================
  // [PHASE 4] VERIFY PASSWORD OTP (Mencegah Brute-Force OTP)
  // ====================================================================
  /**
   * Limitasi: 5 request per menit.
   * Endpoint ini memvalidasi OTP dan akan me-return Scoped JWT berumur 10 menit.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-password-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validasi OTP dan terbitkan Scoped JWT (Password-Reset-Token)' })
  async verifyPasswordOtp(@Body() dto: VerifyPasswordOtpDto) {
    return this.authService.verifyPasswordOtp(dto);
  }

  // ====================================================================
  // [PHASE 4] EXECUTE RESET PASSWORD (Puncak Keamanan)
  // ====================================================================
  /**
   * Menggunakan Custom Guard untuk memastikan hanya Scoped JWT khusus
   * yang dapat mengeksekusi endpoint ini. Access Token biasa akan ditolak.
   */
  @UseGuards(PasswordResetScopeGuard)
  @ApiBearerAuth()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ubah kata sandi dan terminasi semua sesi aktif' })
  async resetPassword(@Req() req, @Body() dto: ResetPasswordDto) {
    // req.user di-inject oleh PasswordResetScopeGuard (berisi sub/userId)
    return this.authService.resetPassword(req.user.sub, dto);
  }
}