import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

// Injeksi Layer Memori & Event
import { RedisService } from '../redis/redis.service';
import { NotificationGateway } from '../notification/notification.gateway';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private redisService: RedisService,
    private notificationGateway: NotificationGateway,
  ) { }

  // =================================================================
  // REGISTER (User Onboarding + Quota Initialization)
  // =================================================================
  async register(dto: RegisterDto) {
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: hash,
          role: 'USER',
          usage: {
            create: {
              simulationQuota: 10,
              totalUsed: 0,
            },
          },
        },
        include: {
          usage: true,
          subscription: true,
        },
      });

      // Secara arsitektural untuk keamanan SaaS, pasca-register user sebaiknya 
      // diarahkan untuk login ulang agar proses penangkapan Device-ID lebih akurat.
      // Namun untuk menjaga backward compatibility dengan FE, kita berikan sesi default.
      const { passwordHash, ...userData } = user;
      return {
        message: 'Registrasi berhasil. Silakan login untuk memulai sesi yang aman.',
        user: userData,
      };

    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Email sudah terdaftar, silakan login.');
        }
      }
      throw error;
    }
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