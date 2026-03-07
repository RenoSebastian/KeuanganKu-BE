import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto, VerifyOtpDto, ResendOtpDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

import { RedisService } from '../redis/redis.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { EmailService } from '../email/email.service';
import { generateOtpEmailTemplate } from '../email/templates/otp-email.template';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redisService: RedisService,
    private notificationGateway: NotificationGateway,
    private emailService: EmailService,
  ) { }

  // =================================================================
  // [PHASE 1] REGISTER: REDIS-FIRST DEFERRED INSERTION
  // =================================================================
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ForbiddenException('Email sudah terdaftar. Silakan langsung login.');
    }

    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const otpData = {
      email: dto.email,
      fullName: dto.fullName,
      passwordHash: hash,
      otpCode: otpCode,
      resendCount: 0,
      lastSentAt: Date.now(),
    };

    // Pendaftaran biasa menggunakan format standar
    await this.redisService.setOtp(dto.email, otpData, 300);

    const htmlTemplate = generateOtpEmailTemplate(dto.fullName, otpCode, false, 'REGISTER');

    this.emailService.sendEmail(dto.email, 'Kode Verifikasi Registrasi Agen', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal mengirim OTP ke ${dto.email}`, err));

    return {
      message: 'OTP berhasil dikirim. Silakan periksa kotak masuk email Anda.',
      expiresIn: '5 Menit',
    };
  }

  // =================================================================
  // [PHASE 1] VERIFY OTP: SYSTEM OF RECORD COMMIT
  // =================================================================
  async verifyOtp(dto: VerifyOtpDto, meta: { ipAddress: string; userAgent: string }) {
    const otpData = await this.redisService.getOtp(dto.email);

    if (!otpData) {
      throw new BadRequestException('Sesi registrasi telah kedaluwarsa atau email tidak valid. Silakan daftar ulang.');
    }

    if (otpData.otpCode !== dto.otpCode) {
      throw new BadRequestException('Kode OTP yang Anda masukkan salah.');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: otpData.email,
          fullName: otpData.fullName,
          passwordHash: otpData.passwordHash,
          role: 'USER',
          usage: {
            create: { simulationQuota: 10, totalUsed: 0 },
          },
        },
      });

      await this.redisService.deleteOtp(dto.email);

      return this.finalizeLoginSession(user, dto.deviceId, meta);

    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ForbiddenException('Terjadi konflik data. Email ini baru saja didaftarkan di sistem utama.');
      }
      throw new InternalServerErrorException('Gagal menyelesaikan registrasi ke basis data. Hubungi administrator.');
    }
  }

  async resendOtp(dto: ResendOtpDto) {
    const otpData = await this.redisService.getOtp(dto.email);

    if (!otpData) throw new BadRequestException('Sesi registrasi tidak ditemukan atau telah kedaluwarsa.');

    const now = Date.now();
    const timeSinceLastSent = now - otpData.lastSentAt;

    if (timeSinceLastSent < 60000) {
      const waitTime = Math.ceil((60000 - timeSinceLastSent) / 1000);
      throw new BadRequestException(`Harap tunggu ${waitTime} detik sebelum meminta OTP baru.`);
    }

    if (otpData.resendCount >= 2) {
      throw new BadRequestException('Batas pengiriman ulang tercapai. Silakan coba daftar ulang setelah sesi ini berakhir (5 Menit).');
    }

    otpData.resendCount += 1;
    otpData.lastSentAt = now;
    await this.redisService.setOtp(dto.email, otpData, 300);

    const htmlTemplate = generateOtpEmailTemplate(otpData.fullName, otpData.otpCode, true, 'REGISTER');

    this.emailService.sendEmail(dto.email, 'Kirim Ulang: Kode Verifikasi Registrasi', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal resend OTP ke ${dto.email}`, err));

    return {
      message: 'OTP berhasil dikirim ulang. Silakan periksa kotak masuk email Anda.',
      resendCount: otpData.resendCount,
      maxResend: 2
    };
  }

  // =================================================================
  // [PHASE 2] LOGIN: 2FA INITIATION (REQUEST OTP)
  // =================================================================
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user) throw new UnauthorizedException('Kredensial tidak valid (Email tidak ditemukan)');

    const pwMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!pwMatches) throw new UnauthorizedException('Kredensial tidak valid (Password salah)');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // [FIX] Kita meminjam struktur data RedisOtpData (memiliki passwordHash), tapi kita isi kosong (karena login tidak butuh hash baru)
    const loginData = {
      email: user.email,
      fullName: user.fullName,
      otpCode: otpCode,
      passwordHash: '', // Dikosongkan, tidak digunakan saat verifikasi login
      resendCount: 0,
      lastSentAt: Date.now(),
    };

    const loginIdentifier = `login:${user.email}`;

    // [FIX] Memanfaatkan setter yang sudah ada secara elegan
    await this.redisService.setOtp(loginIdentifier, loginData, 300);

    // Simpan DeviceID sementara di session biasa (bukan active session), 
    // karena RedisOtpData Anda mungkin tidak memiliki properti deviceId.
    // Alternatif ini sangat aman dan menghindari perubahan interface DTO di RedisService
    await this.redisService.setSession(`pending_device:${user.email}`, {
      sessionId: 'pending',
      deviceId: dto.deviceId,
      socketId: null,
      refreshTokenHash: ''
    });

    const htmlTemplate = generateOtpEmailTemplate(user.fullName, otpCode, false, 'LOGIN');

    this.emailService.sendEmail(user.email, 'Kode Keamanan Akses Portal KeuanganKu', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal mengirim OTP Login ke ${user.email}`, err));

    return {
      message: 'LOGIN_OTP_SENT',
      email: user.email,
      expiresIn: '5 Menit'
    };
  }

  // =================================================================
  // [PHASE 3] VERIFY LOGIN OTP (2FA RESOLUTION)
  // =================================================================
  async verifyLoginOtp(dto: VerifyOtpDto, meta: { ipAddress: string; userAgent: string }) {
    const loginIdentifier = `login:${dto.email}`;

    // [FIX] Memanfaatkan getter yang sudah ada
    const loginData = await this.redisService.getOtp(loginIdentifier);

    if (!loginData) {
      throw new BadRequestException('Sesi login telah kedaluwarsa. Silakan masukkan password kembali.');
    }

    if (loginData.otpCode !== dto.otpCode) {
      throw new BadRequestException('Kode keamanan salah.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        usage: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!user) throw new UnauthorizedException('Pengguna tidak ditemukan di sistem.');

    // [FIX] Memanfaatkan deleter yang sudah ada
    await this.redisService.deleteOtp(loginIdentifier);

    // Ambil device ID asli yang disimpan saat inisiasi
    const pendingSession = await this.redisService.getSession(`pending_device:${dto.email}`);
    const originalDeviceId = pendingSession ? pendingSession.deviceId : dto.deviceId;

    // Bersihkan pending device
    await this.redisService.deleteSession(`pending_device:${dto.email}`);

    return this.finalizeLoginSession(user, originalDeviceId, meta);
  }

  // =================================================================
  // [PHASE 3] RESEND LOGIN OTP
  // =================================================================
  async resendLoginOtp(dto: ResendOtpDto) {
    const loginIdentifier = `login:${dto.email}`;

    // [FIX] Memanfaatkan getter yang sudah ada
    const loginData = await this.redisService.getOtp(loginIdentifier);

    if (!loginData) throw new BadRequestException('Sesi login tidak ditemukan. Silakan ulangi proses login.');

    const now = Date.now();
    const timeSinceLastSent = now - loginData.lastSentAt;

    if (timeSinceLastSent < 60000) {
      const waitTime = Math.ceil((60000 - timeSinceLastSent) / 1000);
      throw new BadRequestException(`Harap tunggu ${waitTime} detik sebelum meminta kode baru.`);
    }

    if (loginData.resendCount >= 2) {
      throw new BadRequestException('Batas pengiriman ulang tercapai. Silakan coba login kembali setelah 5 menit.');
    }

    loginData.resendCount += 1;
    loginData.lastSentAt = now;

    // [FIX] Memanfaatkan setter yang sudah ada
    await this.redisService.setOtp(loginIdentifier, loginData, 300);

    const htmlTemplate = generateOtpEmailTemplate(loginData.fullName, loginData.otpCode, true, 'LOGIN');
    this.emailService.sendEmail(loginData.email, 'Pengingat Kode Keamanan Login', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal resend OTP Login ke ${loginData.email}`, err));

    return {
      message: 'OTP berhasil dikirim ulang.',
      resendCount: loginData.resendCount,
      maxResend: 2
    };
  }

  // =================================================================
  // REFRESH TOKEN ROTATION (Silent Re-authentication)
  // =================================================================
  async refreshTokens(dto: RefreshTokenDto) {
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync(dto.refreshToken, { secret });

      if (payload.type !== 'REFRESH') {
        throw new UnauthorizedException('Token yang diberikan bukan Refresh Token yang valid');
      }

      const userId = payload.sub;

      const activeSession = await this.redisService.getSession(userId);

      if (!activeSession) {
        throw new UnauthorizedException('Sesi telah berakhir atau Anda telah dikeluarkan.');
      }

      if (activeSession.deviceId !== dto.deviceId) {
        await this.redisService.deleteSession(userId);
        throw new UnauthorizedException('Aktivitas mencurigakan terdeteksi. Sesi dihentikan demi keamanan.');
      }

      const rtMatches = await bcrypt.compare(dto.refreshToken, activeSession.refreshTokenHash);
      if (!rtMatches) {
        throw new UnauthorizedException('Kredensial Refresh Token tidak cocok.');
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException('Pengguna tidak ditemukan.');

      const tokens = await this.generateTokens(user.id, user.email, user.role, activeSession.sessionId);

      const salt = await bcrypt.genSalt();
      const newRtHash = await bcrypt.hash(tokens.refresh_token, salt);

      activeSession.refreshTokenHash = newRtHash;
      await this.redisService.setSession(userId, activeSession);

      this.prisma.activeSession.update({
        where: { sessionId: activeSession.sessionId },
        data: { refreshTokenHash: newRtHash, lastActivityAt: new Date() }
      }).catch(err => this.logger.error('Gagal update ActiveSession Hash di DB', err));

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };

    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Sesi kadaluwarsa atau tidak valid. Silakan login kembali.');
    }
  }

  // =================================================================
  // PRIVATE HELPER: STANDARDIZASI PEMBUATAN SESI
  // =================================================================
  private async finalizeLoginSession(user: any, deviceId: string, meta: { ipAddress: string; userAgent: string }) {
    // 1. Otoritas Opsi B (Last-In Wins): Periksa Sesi Lama di Redis
    const oldSession = await this.redisService.getSession(user.id);

    if (oldSession) {
      this.logger.warn(`[Session Kicked] User ${user.email} login dari perangkat baru. Menendang sesi lama.`);

      // Putus koneksi WebSocket lama jika terhubung
      if (oldSession.socketId) {
        this.notificationGateway.forceDisconnectClient(oldSession.socketId, 'concurrent_login');
      }
    }

    // 2. Bangun Sesi Baru
    const sessionId = uuidv4();
    const tokens = await this.generateTokens(user.id, user.email, user.role, sessionId);

    // Hash Refresh Token sebelum masuk Redis & Database
    const salt = await bcrypt.genSalt();
    const rtHash = await bcrypt.hash(tokens.refresh_token, salt);

    // 3. Overwrite Redis (Atomik O(1))
    await this.redisService.setSession(user.id, {
      sessionId,
      deviceId,
      socketId: null,
      refreshTokenHash: rtHash,
    });

    // 4. Sinkronisasi System of Record (PostgreSQL)
    await this.prisma.$transaction([
      this.prisma.activeSession.deleteMany({ where: { userId: user.id } }),
      this.prisma.activeSession.create({
        data: {
          sessionId,
          deviceId,
          userId: user.id,
          ipAddress: meta.ipAddress,
          deviceInfo: meta.userAgent,
          refreshTokenHash: rtHash,
        }
      })
    ]);

    const { passwordHash, ...userData } = user;

    // 5. Return Payload JWT & Profil ke Frontend
    return {
      message: 'Verifikasi berhasil. Anda telah otomatis masuk.',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: userData,
    };
  }

  private async generateTokens(userId: string, email: string, role: string, sessionId: string) {
    const secret = this.config.get<string>('JWT_SECRET');

    // Access Token (Usia Pendek - Contoh: 15 Menit)
    const atPayload = { sub: userId, email, role, sessionId, type: 'ACCESS' };
    const accessToken = await this.jwt.signAsync(atPayload, {
      secret,
      expiresIn: '15m',
    });

    // Refresh Token (Usia Panjang - Contoh: 30 Hari)
    const rtPayload = { sub: userId, sessionId, type: 'REFRESH' };
    const refreshToken = await this.jwt.signAsync(rtPayload, {
      secret,
      expiresIn: '30d',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}