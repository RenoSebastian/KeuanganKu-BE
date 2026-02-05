import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from './../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      // Ambil token dari Header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Fail fast jika JWT_SECRET tidak ada di .env
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  /**
   * validate
   * * Method ini dipanggil otomatis oleh Passport setelah token berhasil di-decode 
   * dan signature-nya valid.
   * * @param payload Data JSON yang ada di dalam token (sub, email, role)
   */
  async validate(payload: { sub: string; email: string; role: string }) {
    // 1. Cek keberadaan user via UsersService
    // payload.sub adalah userId
    const user = await this.usersService.findOne(payload.sub);

    // 2. Validasi status User
    // Jika user tidak ditemukan (misal: soft deleted atau id salah), tolak request
    if (!user) {
      throw new UnauthorizedException('Token tidak valid atau User tidak ditemukan.');
    }

    // 3. Return User
    // Object ini akan di-attach ke Request object (req.user) di Controller
    // UsersService.findOne sudah memastikan password hash tidak ikut dikembalikan.
    return user;
  }
}