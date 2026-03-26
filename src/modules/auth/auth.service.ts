import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyOtpDto as VerifyLoginOtpDto, // Alias untuk OTP Auth Umum
  ResendOtpDto
} from './dto/auth.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto as VerifyPasswordOtpDto } from './dto/verify-otp.dto'; // Alias untuk OTP Reset Password
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

import { RedisService } from '../redis/redis.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { EmailService } from '../email/email.service';
import { generateOtpEmailTemplate } from '../email/templates/otp-email.template';
import { getPasswordResetOtpTemplate } from '../email/templates/password-reset.template';
import { formatToWhatsAppNumber } from '../../common/utils/phone-formatter.util';

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

    // Memastikan data nomor telepon (jika ada) steril sebelum masuk Redis
    const cleanPhoneNumber = dto.phoneNumber ? formatToWhatsAppNumber(dto.phoneNumber) : null;

    const otpData = {
      email: dto.email,
      fullName: dto.fullName,
      passwordHash: hash,
      phoneNumber: cleanPhoneNumber,
      otpCode: otpCode,
      resendCount: 0,
      lastSentAt: Date.now(),
    };

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
  async verifyOtp(dto: VerifyLoginOtpDto, meta: { ipAddress: string; userAgent: string }) {
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
          phoneNumber: (otpData as any).phoneNumber || null,
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

    const loginData = {
      email: user.email,
      fullName: user.fullName,
      otpCode: otpCode,
      passwordHash: '',
      phoneNumber: user.phoneNumber,
      resendCount: 0,
      lastSentAt: Date.now(),
    };

    const loginIdentifier = `login:${user.email}`;

    await this.redisService.setOtp(loginIdentifier, loginData, 300);

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
  async verifyLoginOtp(dto: VerifyLoginOtpDto, meta: { ipAddress: string; userAgent: string }) {
    const loginIdentifier = `login:${dto.email}`;
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

    await this.redisService.deleteOtp(loginIdentifier);

    const pendingSession = await this.redisService.getSession(`pending_device:${dto.email}`);
    const originalDeviceId = pendingSession ? pendingSession.deviceId : dto.deviceId;

    await this.redisService.deleteSession(`pending_device:${dto.email}`);

    return this.finalizeLoginSession(user, originalDeviceId, meta);
  }

  // =================================================================
  // [PHASE 3] RESEND LOGIN OTP
  // =================================================================
  async resendLoginOtp(dto: ResendOtpDto) {
    const loginIdentifier = `login:${dto.email}`;
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
  // REFRESH TOKEN ROTATION
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
  // PRIVATE HELPER: STANDARDIZASI PEMBUATAN SESI & LOGGING
  // =================================================================
  private async finalizeLoginSession(user: any, deviceId: string, meta: { ipAddress: string; userAgent: string }) {
    const oldSession = await this.redisService.getSession(user.id);

    if (oldSession) {
      this.logger.warn(`[Session Kicked] User ${user.email} login dari perangkat baru. Menendang sesi lama.`);

      if (oldSession.socketId) {
        this.notificationGateway.forceDisconnectClient(oldSession.socketId, 'concurrent_login');
      }
    }

    const sessionId = uuidv4();
    const tokens = await this.generateTokens(user.id, user.email, user.role, sessionId);

    const salt = await bcrypt.genSalt();
    const rtHash = await bcrypt.hash(tokens.refresh_token, salt);

    await this.redisService.setSession(user.id, {
      sessionId,
      deviceId,
      socketId: null,
      refreshTokenHash: rtHash,
    });

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
      }),
      this.prisma.userLoginHistory.create({
        data: {
          userId: user.id,
          ipAddress: meta.ipAddress,
          deviceInfo: meta.userAgent,
        }
      })
    ]);

    const { passwordHash, ...userData } = user;

    return {
      message: 'Verifikasi berhasil. Anda telah otomatis masuk.',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user: userData,
    };
  }

  private async generateTokens(userId: string, email: string, role: string, sessionId: string) {
    const secret = this.config.get<string>('JWT_SECRET');

    const atPayload = { sub: userId, email, role, sessionId, type: 'ACCESS' };
    const accessToken = await this.jwt.signAsync(atPayload, {
      secret,
      expiresIn: '15m',
    });

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

  // =================================================================
  // [PHASE 4] FORGOT PASSWORD INITIATION
  // =================================================================
  async forgotPassword(dto: RequestOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, fullName: true }
    });

    // [SECURITY LAYER] Indistinguishable Response (Mencegah enumerasi akun)
    const standardResponse = {
      message: 'Jika email yang Anda masukkan terdaftar di sistem kami, instruksi pemulihan telah dikirimkan.'
    };

    if (!user) {
      // Log silent agar analis keamanan tahu ada upaya terhadap email tak terdaftar
      this.logger.warn(`[Suspicious] Upaya forgot password pada email tak terdaftar: ${dto.email}`);
      return standardResponse;
    }

    // [CORE LOGIC] Menggunakan CSPRNG untuk keamanan absolut (menghindari tebakan pseudo-random)
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Menghapus token pemulihan lama (jika user meminta ulang sebelum expired) untuk menghindari spam/race-condition
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    // Menyimpan token baru ke database dengan TTL 5 menit
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        hashedOTP: hashedOTP,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        retryCount: 0
      }
    });

    const htmlTemplate = getPasswordResetOtpTemplate(user.fullName, otpCode, 5);

    this.emailService.sendEmail(user.email, 'Pemulihan Kata Sandi KeuanganKu', htmlTemplate)
      .catch(err => this.logger.error(`[SILENT FAIL] Gagal mengirim OTP Reset ke ${user.email}`, err));

    return standardResponse;
  }

  // =================================================================
  // [PHASE 4] VERIFY PASSWORD OTP & MINT SCOPED JWT
  // =================================================================
  async verifyPasswordOtp(dto: VerifyPasswordOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    // Indistinguishable error untuk menjaga privasi eksistensi email
    if (!user) throw new BadRequestException('Email atau Kode OTP tidak valid.');

    const tokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id }
    });

    if (!tokenRecord) {
      throw new BadRequestException('Sesi pemulihan tidak ditemukan atau telah kedaluwarsa. Silakan minta ulang OTP.');
    }

    // Validasi Kedaluwarsa Waktu Ter-kunci (TTL)
    if (tokenRecord.expiresAt < new Date()) {
      await this.prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } });
      throw new BadRequestException('Kode OTP telah kedaluwarsa. Silakan ulangi proses pemulihan.');
    }

    // [SECURITY LAYER] Mekanisme Lockout setelah 3x percobaan salah
    if (tokenRecord.retryCount >= 3) {
      await this.prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } });
      this.logger.warn(`[Brute-Force Blocked] Sesi reset sandi dikunci untuk user ${user.email}`);
      throw new ForbiddenException('Terlalu banyak percobaan gagal. Sesi pemulihan dibatalkan demi keamanan. Silakan ulangi proses dari awal.');
    }

    // Validasi Integritas Hash
    const isOtpValid = await bcrypt.compare(dto.otp, tokenRecord.hashedOTP);

    if (!isOtpValid) {
      await this.prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { retryCount: { increment: 1 } }
      });
      throw new BadRequestException('Kode OTP salah.');
    }

    // Jika valid, hancurkan catatan OTP agar tidak bisa digunakan lagi (Replay Attack Prevention)
    await this.prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } });

    // Mencetak SCOPED JWT (Berbeda dari Access Token standar)
    const secret = this.config.get<string>('JWT_SECRET');
    const scopedToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, scope: 'password_reset_only' },
      { secret, expiresIn: '10m' }
    );

    return {
      message: 'Verifikasi berhasil. Silakan buat kata sandi baru Anda.',
      reset_token: scopedToken
    };
  }

  // =================================================================
  // [PHASE 4] EXECUTE RESET PASSWORD & TERMINATE SESSIONS
  // =================================================================
  async resetPassword(userId: string, dto: ResetPasswordDto) {
    const salt = await bcrypt.genSalt();
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);

    // Update sandi baru
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    // [SECURITY LAYER] Sesi Terminasi Global (Zero-Trust)
    // Mencari semua sesi aktif untuk user ini di seluruh perangkat
    const activeSessions = await this.prisma.activeSession.findMany({
      where: { userId: userId }
    });

    // Menggugurkan koneksi WebSockets & Redis cache untuk setiap sesi yang ditemukan
    for (const session of activeSessions) {
      if (session.socketId) {
        this.notificationGateway.forceDisconnectClient(session.socketId, 'password_changed');
      }
      // Kita menghapus session dari Redis menggunakan userId 
      // (asumsi Redis menyimpan session identifier per userId)
      await this.redisService.deleteSession(userId);
    }

    // Membersihkan tabel database sesi
    await this.prisma.activeSession.deleteMany({
      where: { userId: userId }
    });

    this.logger.log(`[Security Audit] Kata sandi direset untuk User ID: ${userId}. Semua sesi aktif telah diterminasi.`);

    return {
      message: 'Kata sandi berhasil diperbarui. Demi keamanan, seluruh sesi Anda pada perangkat lain telah dikeluarkan. Silakan login kembali.'
    };
  }
}