import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Auth') // Label di Swagger
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Daftar user baru karyawan' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) // Return 200 OK (Default Post itu 201)
  @ApiOperation({ summary: 'Masuk dan dapatkan JWT Token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}