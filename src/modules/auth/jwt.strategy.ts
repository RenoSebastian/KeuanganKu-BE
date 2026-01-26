// File: src/modules/auth/strategies/jwt.strategy.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Ambil token dari Header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Pastikan Secret Key ada. Jika tidak, aplikasi akan crash (Fail Fast)
      secretOrKey: config.getOrThrow('JWT_SECRET'), 
    });
  }

  // Payload yang masuk ke sini sudah di-decode dan diverifikasi signature-nya
  async validate(payload: { sub: string; email: string; role: string; unitKerjaId: string }) {
    // Best Practice: Tetap cek ke DB untuk memastikan user masih aktif/eksis.
    // Jika user di-ban/hapus, token valid pun akan ditolak di sini.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    
    // Jika user null (tidak ketemu), Passport akan otomatis melempar 401 Unauthorized
    if (!user) {
      return null;
    }

    // Hapus password hash agar tidak terbawa ke Controller (req.user)
    const { passwordHash, ...userWithoutPassword } = user;
    
    // Object ini akan tersedia di Controller via @GetUser() atau request.user
    return userWithoutPassword;
  }
}