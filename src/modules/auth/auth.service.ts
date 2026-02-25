import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt'; // [FIX] Menggunakan bcrypt agar konsisten dengan UsersService
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

  // =================================================================
  // REGISTER (User Onboarding + Quota Initialization)
  // =================================================================
  async register(dto: RegisterDto) {
    // 1. Hash Password
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(dto.password, salt);

    try {
      // 2. Simpan ke DB dengan Atomic Transaction
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash: hash,
          role: 'USER', // Default Role

          // [BLUEPRINT IMPLEMENTATION] Inisialisasi Kuota Awal
          // User baru otomatis mendapat 3 Token Gratis
          usage: {
            create: {
              simulationQuota: 10,
              totalUsed: 0,
            },
          },
        },
        // [CRITICAL] Include Usage & Sub agar FE langsung dapat state
        include: {
          usage: true,
          subscription: true,
        },
      });

      // 3. Return Token & User Context
      return this.signToken(user);

    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        // Handle Duplicate Email
        if (error.code === 'P2002') {
          throw new ForbiddenException('Email sudah terdaftar, silakan login.');
        }
      }
      throw error;
    }
  }

  // =================================================================
  // LOGIN (Credential Check + State Retrieval)
  // =================================================================
  async login(dto: LoginDto) {
    // 1. Cari User + Include Data Penting
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        // [INTEGRATION] Load Quota & Sub untuk Initial State di FE
        usage: true,
        subscription: {
          include: {
            plan: true, // Sertakan info paket (misal: "Pro Monthly")
          },
        },
      },
    });

    if (!user) throw new ForbiddenException('Kredensial tidak valid (Email tidak ditemukan)');

    // 2. Verifikasi Password
    const pwMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!pwMatches) throw new ForbiddenException('Kredensial tidak valid (Password salah)');

    // 3. Generate Token
    return this.signToken(user);
  }

  // =================================================================
  // HELPER: TOKEN SIGNING
  // =================================================================
  async signToken(user: any) {
    // Payload JWT: HANYA data statis/immutable.
    // Jangan masukkan 'quota' di sini karena quota berubah-ubah.
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      unitKerjaId: user.unitKerjaId,
    };

    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d', // Token berlaku 1 hari
      secret: secret,
    });

    // Remove sensitive data
    const { passwordHash, ...userData } = user;

    // Return object lengkap untuk FE
    return {
      access_token: token,
      user: userData, // FE akan menyimpan ini ke Global Store (Zustand/Context)
    };
  }
}