import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  // --- REGISTER ---
  /**
   * Register Logic (Frictionless)
   * Meneruskan data ke UsersService untuk pembuatan akun.
   * Tidak ada lagi validasi Unit Kerja atau NIP di sini.
   */
  async register(dto: CreateUserDto) {
    // Logic pembuatan user & hashing ada di UsersService
    return this.usersService.createUser(dto);
  }

  // --- LOGIN ---
  /**
   * Login Logic
   * 1. Validasi keberadaan user (By Email)
   * 2. Validasi password (Bcrypt Compare)
   * 3. Generate JWT Token
   */
  async login(dto: LoginDto) {
    // 1. Cari User by Email
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      // Return 401 Unauthorized dengan pesan generik (Security Best Practice)
      throw new UnauthorizedException('Email atau password salah');
    }

    // 2. Cek Password
    // user.passwordHash didapat dari UsersService (pastikan field ini ter-select di prisma query service)
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    // 3. Return Token
    return this.signToken(user.id, user.email, user.role);
  }

  // --- HELPER: SIGN TOKEN ---
  /**
   * Generate JWT Token
   * Payload disederhanakan agar stateless dan ringan.
   */
  private async signToken(userId: string, email: string, role: string) {
    const payload = {
      sub: userId,
      email,
      role,
    };

    // Secret diambil otomatis oleh JwtModule dari ConfigService (Environment Variables)
    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      user: {
        id: userId,
        email,
        role,
      },
    };
  }
}