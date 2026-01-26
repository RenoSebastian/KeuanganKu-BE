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
          unitKerjaId: dto.unitKerjaId, // Pastikan FE mengirim unitKerjaId yang valid
          dateOfBirth: new Date(), // Placeholder, nanti user update profil sendiri
        },
      });

      // 3. Return Token dengan Claim Lengkap (Role & Unit)
      return this.signToken(user.id, user.email, user.role, user.unitKerjaId);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        // Handle Error Duplicate (P2002)
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

    // 3. Return Token dengan Claim Lengkap (Role & Unit)
    return this.signToken(user.id, user.email, user.role, user.unitKerjaId);
  }

  // --- HELPER: SIGN TOKEN (Updated) ---
  async signToken(userId: string, email: string, role: string, unitKerjaId: string) {
    // Payload ini akan dibaca oleh Passport Strategy & Frontend (via jwt-decode)
    const payload = {
      sub: userId,
      email,
      role,
      unitKerjaId
    };

    const secret = this.config.get('JWT_SECRET');
    
    // Generate Token
    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d', // Token valid 1 hari (Security Best Practice)
      secret: secret,
    });

    return {
      access_token: token,
      // Kembalikan juga data user plain agar FE tidak wajib decode token saat login sukses
      user: {
        id: userId,
        email,
        role,
        unitKerjaId
      }
    };
  }
}