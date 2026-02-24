// File: src/modules/auth/auth.service.ts

import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service'; // Sesuaikan path jika berbeda struktur foldernya
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

  // --- REGISTER (Updated for Phase 3: User Onboarding Logic) ---
  async register(dto: RegisterDto) {
    // 1. Hash Password
    const hash = await argon.hash(dto.password);

    try {
      // 2. Simpan ke DB
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: hash,
          role: 'USER', // Default Role

          // [PHASE 3 UPDATE] Inisialisasi Kuota (Welcome Bonus)
          // Kita menggunakan Nested Write untuk membuat UserUsage sekaligus saat User dibuat.
          usage: {
            create: {
              simulationQuota: 3, // Welcome Bonus: 3 Token Gratis
              totalUsed: 0,       // Counter penggunaan dimulai dari 0
            },
          },
        },
      });

      // 3. Return Token
      // Saat baru daftar, unitKerjaId pasti null.
      return this.signToken(user.id, user.email, user.role, user.unitKerjaId);

    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Email sudah terdaftar');
        }
      }
      throw error;
    }
  }

  // --- LOGIN (Tetap Sama) ---
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new ForbiddenException('Kredensial salah (Email tidak ditemukan)');

    const pwMatches = await argon.verify(user.passwordHash, dto.password);
    if (!pwMatches) throw new ForbiddenException('Kredensial salah (Password salah)');

    return this.signToken(user.id, user.email, user.role, user.unitKerjaId);
  }

  // --- HELPER: SIGN TOKEN ---
  async signToken(userId: string, email: string, role: string, unitKerjaId: string | null) {
    const payload = {
      sub: userId,
      email,
      role,
      unitKerjaId // Bisa null
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