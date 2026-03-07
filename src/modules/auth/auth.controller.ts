import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
  BadRequestException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, VerifyOtpDto, ResendOtpDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth') // Label di Swagger
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // ====================================================================
  // [PHASE 4] REGISTER ENDPOINT (Redis-First Entry Point)
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
  // [PHASE 4] VERIFY OTP ENDPOINT (Database Commit & Auto-Login)
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
    // [LOGIC] Mekanisme Fallback Deterministik:
    const finalDeviceId = headerDeviceId || dto.deviceId;

    if (!finalDeviceId) {
      throw new BadRequestException('Identitas perangkat (X-Device-ID) tidak ditemukan. Keamanan sesi tidak dapat dijamin.');
    }

    dto.deviceId = finalDeviceId;

    // Delegasi ke Service untuk validasi, insert ke DB, dan pembuatan JWT
    return this.authService.verifyOtp(dto, { ipAddress, userAgent });
  }

  // ====================================================================
  // [PHASE 4] RESEND OTP ENDPOINT
  // ====================================================================
  /**
   * Permintaan ulang OTP
   * Meskipun di Service sudah ada Cooldown 60 detik, kita tetap memasang Throttle
   * di level Controller untuk mencegah spam memori pada NestJS.
   */
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kirim ulang kode OTP ke email pendaftar' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // ====================================================================
  // LOGIN ENDPOINT (Single Concurrent Session & Anti-Fraud Layer)
  // ====================================================================
  /**
   * * [STRATEGY] Menggunakan Rate Limiting yang lebih ketat dibandingkan rute global.
   * - limit: 5 percobaan
   * - ttl: 300.000ms (5 Menit)
   * Ini akan menangani skenario "Millisecond Collision" dan mencegah spam login 
   * yang mencoba memicu mekanisme kick-out secara berulang (DoS pada sesi user).
   */
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Masuk dan dapatkan Hybrid JWT Token (AT & RT)' })
  @ApiHeader({
    name: 'x-device-id',
    description: 'Device Fingerprint / AppMySite Client ID untuk Single Session',
    required: true,
  })
  login(
    @Body() dto: LoginDto,
    @Headers('x-device-id') headerDeviceId: string,
    @Headers('user-agent') userAgent: string,
    @Ip() ipAddress: string,
  ) {
    // [LOGIC] Mekanisme Fallback Deterministik:
    const finalDeviceId = headerDeviceId || dto.deviceId;

    if (!finalDeviceId) {
      throw new BadRequestException('Identitas perangkat (X-Device-ID) tidak ditemukan. Keamanan sesi tidak dapat dijamin.');
    }

    // Standardisasi nilai DTO agar seragam saat diproses di Business Logic (Service)
    dto.deviceId = finalDeviceId;

    return this.authService.login(dto, { ipAddress, userAgent });
  }

  // ====================================================================
  // ENDPOINT UNTUK SILENT RE-AUTHENTICATION
  // ====================================================================
  /**
   * Refresh Token juga dilindungi limitasi untuk mencegah eksploitasi rotasi token.
   */
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
    // [LOGIC] Validasi ketat untuk menghindari Session Hijacking
    const finalDeviceId = headerDeviceId || dto.deviceId;

    if (!finalDeviceId) {
      throw new BadRequestException('Header X-Device-ID wajib disertakan untuk melakukan rotasi token.');
    }

    dto.deviceId = finalDeviceId;

    return this.authService.refreshTokens(dto);
  }
}