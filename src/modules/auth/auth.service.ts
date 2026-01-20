import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // --- REGISTER ---
  async register(dto: RegisterDto) {
    // 1. Hash Password
    const hash = await argon.hash(dto.password);

    try {
      // 2. Simpan ke DB
      const user = await this.prisma.user.create({
        data: {
          nip: dto.nip,
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: hash,
          unitKerjaId: dto.unitKerjaId, // Pastikan Unit Kerja ID Valid nanti
          dateOfBirth: new Date(), // Default sementara, nanti diupdate user
        },
      });

      // 3. Return Token
      return this.signToken(user.id, user.email, user.role);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('NIP atau Email sudah terdaftar');
        }
      }
      throw error;
    }
  }

  // --- LOGIN ---
  async login(dto: LoginDto) {
    // 1. Cari User by Email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Kredensial salah (Email tidak ditemukan)');

    // 2. Cek Password (Argon2 Verify)
    const pwMatches = await argon.verify(user.passwordHash, dto.password);
    if (!pwMatches) throw new ForbiddenException('Kredensial salah (Password salah)');

    // 3. Return Token
    return this.signToken(user.id, user.email, user.role);
  }

  // --- HELPER: SIGN TOKEN ---
  async signToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d', // Token berlaku 1 hari
      secret: secret,
    });

    return {
      access_token: token,
      user: {
        id: userId,
        email: email,
        role: role
      }
    };
  }
}