// File: src/modules/auth/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service'; // Sesuaikan path jika perlu
import { RedisService } from '../redis/redis.service'; // [NEW] Injeksi In-Memory Storage

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private redisService: RedisService, // [NEW] Inject Redis untuk State Management
  ) {
    super({
      // Ambil token dari Header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Jika JWT expired, otomatis ditolak sebelum masuk ke method validate()
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  // Payload yang masuk ke sini sudah di-decode, diverifikasi signature-nya, dan belum expired
  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    unitKerjaId?: string;
    sessionId: string; // [NEW] Hasil dari arsitektur Fase 4
    type: string;      // [NEW] Indikator ACCESS atau REFRESH
  }) {

    // =================================================================
    // 1. LAYER 1: VALIDASI TIPE TOKEN
    // =================================================================
    // Mencegah eksploitasi jika ada pihak yang mencoba mengirimkan Refresh Token
    // ke endpoint yang seharusnya dilindungi Access Token.
    if (payload.type !== 'ACCESS') {
      throw new UnauthorizedException('Token yang digunakan tidak valid untuk otorisasi rute ini.');
    }

    // =================================================================
    // 2. LAYER 2: VALIDASI SINGLE CONCURRENT SESSION (REDIS STATE)
    // =================================================================
    const activeSession = await this.redisService.getSession(payload.sub);

    // Kasus A: Redis kosong (Sesi sudah expired di memori atau user telah logout manual)
    if (!activeSession) {
      throw new UnauthorizedException('Sesi aktif tidak ditemukan di server. Silakan masuk kembali.');
    }

    // Kasus B: [THE KICK-OUT MECHANISM] 
    // SessionId di token BEDA dengan SessionId di Redis.
    // Ini berarti JWT ini adalah sisa-sisa sesi lama sebelum ditimpa oleh login terbaru.
    if (activeSession.sessionId !== payload.sessionId) {
      throw new UnauthorizedException('Akses ditolak. Akun Anda sedang digunakan di perangkat lain (Concurrent Login Detected).');
    }

    // =================================================================
    // 3. LAYER 3: VALIDASI EKSISTENSI (POSTGRESQL)
    // =================================================================
    // Memastikan akun pengguna belum di-banned atau dihapus secara permanen.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Entitas pengguna tidak ditemukan di dalam sistem.');
    }

    // Hapus password hash agar tidak terbawa ke Controller (req.user)
    const { passwordHash, ...userWithoutPassword } = user;

    // Object ini akan tersedia di Controller via @GetUser() atau request.user
    return userWithoutPassword;
  }
}