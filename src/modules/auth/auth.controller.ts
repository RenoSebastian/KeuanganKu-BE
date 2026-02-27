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
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler'; // [NEW] Import Throttle untuk Rate Limiting

@ApiTags('Auth') // Label di Swagger
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Daftar user baru karyawan' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * LOGIN ENDPOINT (Single Concurrent Session & Anti-Fraud Layer)
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
    // Prioritaskan Header, jika kosong ambil dari Body DTO.
    const finalDeviceId = headerDeviceId || dto.deviceId;

    if (!finalDeviceId) {
      throw new BadRequestException('Identitas perangkat (X-Device-ID) tidak ditemukan. Keamanan sesi tidak dapat dijamin.');
    }

    // Standardisasi nilai DTO agar seragam saat diproses di Business Logic (Service)
    dto.deviceId = finalDeviceId;

    // Panggil Service. Catatan: Logika "3 perpindahan Device-ID dalam 5 menit" 
    // idealnya diperiksa di level Service menggunakan pencatatan histori di Redis.
    return this.authService.login(dto, { ipAddress, userAgent });
  }

  // ====================================================================
  // [NEW] ENDPOINT UNTUK SILENT RE-AUTHENTICATION
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