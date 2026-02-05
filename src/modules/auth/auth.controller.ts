import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public() // Bypass Auth Guard (Bisa diakses tanpa token)
  @Post('register')
  @ApiOperation({ summary: 'Daftar agen baru (Frictionless)' })
  @ApiResponse({ status: 201, description: 'Agen berhasil terdaftar.' })
  @ApiResponse({ status: 409, description: 'Email sudah digunakan.' })
  @ApiResponse({ status: 400, description: 'Validasi data gagal.' })
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Public() // Bypass Auth Guard
  @Post('login')
  @HttpCode(HttpStatus.OK) // Return 200 OK (Standar REST untuk Login bukan 201)
  @ApiOperation({ summary: 'Login dan dapatkan Access Token' })
  @ApiResponse({ status: 200, description: 'Login berhasil.' })
  @ApiResponse({ status: 401, description: 'Email atau password salah.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}