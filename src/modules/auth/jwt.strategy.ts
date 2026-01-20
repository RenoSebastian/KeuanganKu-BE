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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // PERBAIKAN DI SINI:
      // Gunakan getOrThrow (NestJS v9+) untuk memastikan value tidak undefined.
      // Ini akan melempar error jika JWT_SECRET tidak ada di .env, yang mana bagus untuk security.
      secretOrKey: config.getOrThrow('JWT_SECRET'), 
    });
  }

  async validate(payload: { sub: string; email: string }) {
    // Fungsi ini jalan otomatis jika Token Valid
    // Kita cari user di DB berdasarkan ID di token
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    
    // Hapus password hash agar tidak terekspos ke controller
    if (user) {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    
    return user; // Data ini akan nempel di @GetUser()
  }
}