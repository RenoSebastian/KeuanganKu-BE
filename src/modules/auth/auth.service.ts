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
import { generateBaseEmailTemplate } from '../email/templates/base-email.template';

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
  // [PHASE 3] REGISTER: REDIS-FIRST DEFERRED INSERTION
  // =================================================================
  async register(dto: RegisterDto) {
    // 1. Gatekeeper: Cek PostgreSQL agar email yang sudah aktif tidak ditimpa
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ForbiddenException('Email sudah terdaftar. Silakan langsung login.');
    }

    // 2. Kriptografi: Hash password di memori (tidak di DB)
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);

    // 3. Generate OTP: Buat 6 digit angka acak (100000 - 999999)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. State Creation: Bungkus data sesuai kontrak RedisOtpData (Fase 2)
    // [FIX] Menghapus nip dan unitKerjaId agar murni profil Agen
    const otpData = {
      email: dto.email,
      fullName: dto.fullName,
      passwordHash: hash,
      otpCode: otpCode,
      resendCount: 0,
      lastSentAt: Date.now(),
    };

    // 5. In-Memory Storage: Simpan ke Redis dengan TTL 5 Menit (300 detik)
    await this.redisService.setOtp(dto.email, otpData, 300);

    // 6. Asynchronous Delegation: Kirim Email Fire-and-Forget
    const emailContent = `
      <h2 style="color: #0d9488;">Verifikasi Registrasi KeuanganKu</h2>
      <p>Halo, ${dto.fullName}!</p>
      <p>Berikut adalah kode verifikasi OTP Anda. Kode ini akan hangus dalam waktu <strong>5 menit</strong>.</p>
      <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; text-align: center; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otpCode}</span>
      </div>
      <p>Jika Anda tidak merasa melakukan pendaftaran, abaikan email ini.</p>
    `;

    const htmlTemplate = generateBaseEmailTemplate('OTP Registrasi - KeuanganKu', emailContent);

    this.emailService.sendEmail(dto.email, 'Kode Verifikasi KeuanganKu', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal mengirim OTP ke ${dto.email}`, err));

    return {
      message: 'OTP berhasil dikirim. Silakan periksa kotak masuk email Anda.',
      expiresIn: '5 Menit',
    };
  }

  // =================================================================
  // [PHASE 3] VERIFY OTP: SYSTEM OF RECORD COMMIT & AUTO-LOGIN
  // =================================================================
  async verifyOtp(dto: VerifyOtpDto, meta: { ipAddress: string; userAgent: string }) {
    // 1. State Lookup
    const otpData = await this.redisService.getOtp(dto.email);

    if (!otpData) {
      throw new BadRequestException('Sesi registrasi telah kedaluwarsa atau email tidak valid. Silakan daftar ulang.');
    }

    // 2. Exact Match Validation
    if (otpData.otpCode !== dto.otpCode) {
      throw new BadRequestException('Kode OTP yang Anda masukkan salah.');
    }

    // 3. System of Record Insertion: Pindahkan ke PostgreSQL
    // [FIX] Payload Prisma dibersihkan dari field yang tidak relevan
    try {
      const user = await this.prisma.user.create({
        data: {
          email: otpData.email,
          fullName: otpData.fullName,
          passwordHash: otpData.passwordHash,
          role: 'USER', // Role standar untuk Agen SaaS
          usage: {
            create: {
              simulationQuota: 10, // Kuota awal
              totalUsed: 0,
            },
          },
        },
      });

      // 4. Garbage Collection / Idempotency
      await this.redisService.deleteOtp(dto.email);

      // 5. Seamless Auto-Login (Identik dengan logic Login normal)
      const sessionId = uuidv4();
      const tokens = await this.generateTokens(user.id, user.email, user.role, sessionId);

      const salt = await bcrypt.genSalt();
      const rtHash = await bcrypt.hash(tokens.refresh_token, salt);

      await this.redisService.setSession(user.id, {
        sessionId,
        deviceId: dto.deviceId,
        socketId: null,
        refreshTokenHash: rtHash,
      });

      await this.prisma.activeSession.create({
        data: {
          sessionId,
          deviceId: dto.deviceId,
          userId: user.id,
          ipAddress: meta.ipAddress,
          deviceInfo: meta.userAgent,
          refreshTokenHash: rtHash,
        }
      });

      const { passwordHash, ...userData } = user;

      return {
        message: 'Registrasi dan verifikasi berhasil. Anda telah otomatis login.',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: userData,
      };

    } catch (error) {
      // Menangkap potensi race condition jika di tengah 5 menit admin mendaftarkan email yang sama
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ForbiddenException('Terjadi konflik data. Email ini baru saja didaftarkan di sistem utama.');
      }
      throw new InternalServerErrorException('Gagal menyelesaikan registrasi ke basis data. Hubungi administrator.');
    }
  }

  // =================================================================
  // [PHASE 3] RESEND OTP: RATE LIMITING & COOLDOWN LOGIC
  // =================================================================
  async resendOtp(dto: ResendOtpDto) {
    // 1. State Lookup
    const otpData = await this.redisService.getOtp(dto.email);

    if (!otpData) {
      throw new BadRequestException('Sesi registrasi tidak ditemukan atau telah kedaluwarsa. Silakan daftar ulang.');
    }

    const now = Date.now();
    const timeSinceLastSent = now - otpData.lastSentAt;

    // 2. Defense Layer 1: Cooldown (60 Detik)
    if (timeSinceLastSent < 60000) {
      const waitTime = Math.ceil((60000 - timeSinceLastSent) / 1000);
      throw new BadRequestException(`Harap tunggu ${waitTime} detik sebelum meminta OTP baru.`);
    }

    // 3. Defense Layer 2: Hard Limit (Max 2 Resend)
    if (otpData.resendCount >= 2) {
      throw new BadRequestException('Batas pengiriman ulang tercapai. Silakan periksa folder Spam Anda atau coba daftar ulang setelah sesi ini berakhir (5 Menit).');
    }

    // 4. Update State Variables
    otpData.resendCount += 1;
    otpData.lastSentAt = now;

    // Simpan kembali ke Redis. (Mengembalikan TTL ke 300s agar user punya cukup waktu membaca email baru)
    await this.redisService.setOtp(dto.email, otpData, 300);

    // 5. Delegasikan ulang pengiriman dengan OTP yang SAMA
    const emailContent = `
      <h2 style="color: #0d9488;">Kirim Ulang: Verifikasi Registrasi KeuanganKu</h2>
      <p>Halo, ${otpData.fullName}!</p>
      <p>Sesuai permintaan Anda, ini adalah pengingat untuk kode verifikasi OTP Anda.</p>
      <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; text-align: center; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937;">${otpData.otpCode}</span>
      </div>
      <p>Jika Anda tidak merasa meminta pengiriman ulang ini, mohon abaikan email ini.</p>
    `;

    const htmlTemplate = generateBaseEmailTemplate('Kirim Ulang OTP Registrasi - KeuanganKu', emailContent);

    this.emailService.sendEmail(dto.email, 'Kirim Ulang: Kode Verifikasi KeuanganKu', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal resend OTP ke ${dto.email}`, err));

    return {
      message: 'OTP berhasil dikirim ulang. Silakan periksa kotak masuk email Anda.',
      resendCount: otpData.resendCount,
      maxResend: 2
    };
  }

  // =================================================================
  // LOGIN (Single Concurrent Session & Hybrid JWT)
  // =================================================================
  async login(dto: LoginDto, meta: { ipAddress: string; userAgent: string }) {
    // 1. Validasi Kredensial Database
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        usage: true,
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!user) throw new ForbiddenException('Kredensial tidak valid (Email tidak ditemukan)');

    const pwMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!pwMatches) throw new ForbiddenException('Kredensial tidak valid (Password salah)');

    // 2. Otoritas Opsi B (Last-In Wins): Periksa Sesi Lama di Redis
    const oldSession = await this.redisService.getSession(user.id);

    if (oldSession) {
      this.logger.warn(`[Session Kicked] User ${user.email} login dari perangkat baru. Menendang sesi lama.`);

      // Putus koneksi WebSocket lama jika terhubung
      if (oldSession.socketId) {
        this.notificationGateway.forceDisconnectClient(oldSession.socketId, 'concurrent_login');
      }
    }

    // 3. Bangun Sesi Baru
    const sessionId = uuidv4();
    const tokens = await this.generateTokens(user.id, user.email, user.role, sessionId);

    // Hash Refresh Token sebelum masuk Redis & Database (Mencegah eksploitasi jika DB bocor)
    const salt = await bcrypt.genSalt();
    const rtHash = await bcrypt.hash(tokens.refresh_token, salt);

    // 4. Overwrite Redis (Atomik O(1))
    await this.redisService.setSession(user.id, {
      sessionId,
      deviceId: dto.deviceId,
      socketId: null, // Socket akan diisi saat FE melakukan inisialisasi WSS pasca-login
      refreshTokenHash: rtHash,
    });

    // 5. Sinkronisasi System of Record (PostgreSQL)
    // Gunakan Transaction untuk memastikan konsistensi penghapusan dan pembuatan sesi
    await this.prisma.$transaction([
      this.prisma.activeSession.deleteMany({ where: { userId: user.id } }),
      this.prisma.activeSession.create({
        data: {
          sessionId,
          deviceId: dto.deviceId,
          userId: user.id,
          ipAddress: meta.ipAddress,
          deviceInfo: meta.userAgent,
          refreshTokenHash: rtHash,
        }
      })
    ]);

    const { passwordHash, ...userData } = user;

    // 6. Return Payload ke Frontend
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: userData,
    };
  }

  // =================================================================
  // REFRESH TOKEN ROTATION (Silent Re-authentication)
  // =================================================================
  async refreshTokens(dto: RefreshTokenDto) {
    try {
      // 1. Ekstrak data dari Refresh Token (yang berbentuk JWT)
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync(dto.refreshToken, { secret });

      if (payload.type !== 'REFRESH') {
        throw new UnauthorizedException('Token yang diberikan bukan Refresh Token yang valid');
      }

      const userId = payload.sub;

      // 2. Validasi terhadap In-Memory State (Redis)
      const activeSession = await this.redisService.getSession(userId);

      if (!activeSession) {
        throw new UnauthorizedException('Sesi telah berakhir atau Anda telah dikeluarkan.');
      }

      // 3. Validasi Device Fingerprint (Mencegah Session Hijacking)
      if (activeSession.deviceId !== dto.deviceId) {
        // [SECURITY BREACH DETECTED]
        // Jika Refresh Token valid tapi dimainkan di Device ID berbeda, 
        // kita musnahkan sesi karena indikasi pencurian token.
        await this.redisService.deleteSession(userId);
        throw new UnauthorizedException('Aktivitas mencurigakan terdeteksi. Sesi dihentikan demi keamanan.');
      }

      // 4. Validasi Kriptografis RT dengan Hash di Redis
      const rtMatches = await bcrypt.compare(dto.refreshToken, activeSession.refreshTokenHash);
      if (!rtMatches) {
        throw new UnauthorizedException('Kredensial Refresh Token tidak cocok.');
      }

      // 5. Terbitkan Pasangan Token Baru (Rotation)
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException('Pengguna tidak ditemukan.');

      // Gunakan sessionId yang sama untuk mempertahankan kontiunitas sesi
      const tokens = await this.generateTokens(user.id, user.email, user.role, activeSession.sessionId);

      const salt = await bcrypt.genSalt();
      const newRtHash = await bcrypt.hash(tokens.refresh_token, salt);

      // 6. Update Redis dengan Hash Baru
      activeSession.refreshTokenHash = newRtHash;
      await this.redisService.setSession(userId, activeSession);

      // (Opsional) Update PostgreSQL secara asinkron (Fire and Forget) untuk performa
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
  // HELPER: HYBRID TOKEN GENERATOR
  // =================================================================
  private async generateTokens(userId: string, email: string, role: string, sessionId: string) {
    const secret = this.config.get<string>('JWT_SECRET');

    // Access Token (Usia Pendek - Contoh: 15 Menit)
    // Menyimpan sessionId untuk divalidasi oleh Guard di setiap request API
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