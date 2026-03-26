// File: src/modules/auth/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {
    super({
      // Ekstraksi token dari header 'Authorization: Bearer <token>'
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  /**
   * Method validate() adalah gerbang utama otorisasi setelah signature JWT terverifikasi.
   * Objek yang dikembalikan di sini akan menjadi 'req.user'.
   */
  async validate(payload: any) {
    // =================================================================
    // [PRIORITY] FASE 5: BYPASS LOGIC UNTUK PASSWORD RESET (SCOPED JWT)
    // =================================================================
    // Kita melakukan pengecekan scope sebagai prioritas tertinggi.
    // Jika token ini adalah 'Reset Token', kita tidak boleh mengecek Redis atau DB
    // karena user belum dalam kondisi login (authenticated session).
    if (payload.scope === 'password_reset_only') {
      this.logger.debug(`[AUTH] Scoped Token detected for User ID: ${payload.sub}`);

      return {
        id: payload.sub,     // Mapping 'sub' dari JWT ke 'id' untuk konsistensi sistem
        email: payload.email,
        scope: payload.scope // Wajib dikembalikan agar terbaca oleh PasswordResetScopeGuard
      };
    }

    // =================================================================
    // 1. LAYER 1: VALIDASI TIPE TOKEN (UNTUK SESI LOGIN)
    // =================================================================
    // Menolak jika Refresh Token disalahgunakan untuk akses endpoint regular.
    if (payload.type !== 'ACCESS') {
      throw new UnauthorizedException('Token yang digunakan tidak valid untuk otorisasi rute ini.');
    }

    // =================================================================
    // 2. LAYER 2: VALIDASI SINGLE CONCURRENT SESSION (REDIS)
    // =================================================================
    // Mengambil state sesi aktif dari memori Redis.
    const activeSession = await this.redisService.getSession(payload.sub);

    if (!activeSession) {
      throw new UnauthorizedException('Sesi aktif tidak ditemukan di server. Silakan masuk kembali.');
    }

    // Kick-out Mechanism: Validasi apakah sessionId di JWT masih relevan dengan Redis.
    if (activeSession.sessionId !== payload.sessionId) {
      throw new UnauthorizedException('Akses ditolak. Akun Anda sedang digunakan di perangkat lain.');
    }

    // =================================================================
    // 3. LAYER 3: VALIDASI EKSISTENSI PENGGUNA (DB SYNC)
    // =================================================================
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Entitas pengguna tidak ditemukan.');
    }

    // Sanitasi: Hapus hash password agar tidak bocor ke lapisan Controller/UI.
    const { passwordHash, ...userWithoutPassword } = user;

    // Return object ini akan disuntikkan ke Request sebagai 'user'.
    return userWithoutPassword;
  }

  // Logger internal untuk mempermudah debugging jika terjadi kegagalan bypass
  private readonly logger = {
    debug: (msg: string) => console.log(`[JwtStrategy] ${msg}`),
  };
}