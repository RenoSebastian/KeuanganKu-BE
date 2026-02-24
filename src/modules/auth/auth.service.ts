// File: src/modules/auth/auth.service.ts

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
  ) { }

  // --- REGISTER (Simplified Flow) ---
  async register(dto: RegisterDto) {
    // 1. Hash Password
    const hash = await argon.hash(dto.password);

    try {
      // 2. Simpan ke DB dengan data minimal (Nama, Email, Password)
      // Field lain seperti unitKerjaId, nip, dan dateOfBirth akan otomatis NULL
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: hash,
          role: 'USER', // Tetap set default role USER
          usage: {
            create: {
              clientLimit: 5, // Jatah bawaan saat daftar
              clientCount: 0,
            },
          },
        },
      });

      // 3. Return Token
      // user.unitKerjaId akan bernilai null, ini tidak masalah bagi JWT
      return this.signToken(user.id, user.email, user.role, user.unitKerjaId);

    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Hanya Email yang dicek karena NIP tidak dikirim saat register
          throw new ForbiddenException('Email sudah terdaftar');
        }
      }
      throw error;
    }
  }

  // --- LOGIN (Tetap Sama, tapi mendukung unitKerjaId null) ---
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Kredensial salah (Email tidak ditemukan)');

    const pwMatches = await argon.verify(user.passwordHash, dto.password);
    if (!pwMatches) throw new ForbiddenException('Kredensial salah (Password salah)');

    return this.signToken(user.id, user.email, user.role, user.unitKerjaId);
  }

  // --- HELPER: SIGN TOKEN (Updated with Nullable unitKerjaId) ---
  // unitKerjaId diubah tipe datanya menjadi string | null
  async signToken(userId: string, email: string, role: string, unitKerjaId: string | null) {
    const payload = {
      sub: userId,
      email,
      role,
      unitKerjaId // Akan berisi null jika belum diisi
    };

    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d',
      secret: secret,
    });

    return {
      access_token: token,
      user: {
        id: userId,
        email,
        role,
        unitKerjaId
      }
    };
  }
}