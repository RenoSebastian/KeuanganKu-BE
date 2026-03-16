import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as client from '@prisma/client';

import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

// Import RedisService
import { RedisService } from '../redis/redis.service';

// DTO Imports
import { UsersService } from './users.service';
import { EditUserDto } from './dto/edit-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly redisService: RedisService
  ) { }

  // =================================================================
  // SELF-SERVICE (User Profile & Subscription State)
  // =================================================================

  @Get('me')
  @ApiOperation({
    summary: 'Get My Profile (With Subscription & Usage Quota)',
    description:
      'Mengambil data profil user yang sedang login, termasuk status Subscription (FREE/PRO) dan sisa Kuota Simulasi.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profil user berhasil diambil.',
    // [NOTE]: Respons akan menyertakan object `subscription` dan `usage`
  })
  getMe(@GetUser('id') userId: string) {
    // Service ini WAJIB melakukan join ke tabel UserUsage & UserSubscription
    return this.userService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update My Profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profil berhasil diperbarui.',
  })
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    return this.userService.editUser(userId, dto);
  }

  // =================================================================
  // ADMIN ONLY (Employee Management)
  // =================================================================

  // Admin Routes have been moved to admin-users.controller.ts to avoid duplication.

  // =================================================================
  // [NEW] REAL-TIME HEARTBEAT PING
  // =================================================================

  @Post('heartbeat')
  @ApiOperation({
    summary: 'Send Online Heartbeat Pong',
    description: 'Endpoint ringan yang selalu dipanggil oleh frontend PWA (setiap 30-45 detik) untuk menandakan user aktif di sistem. Menyimpan status di Redis In-Memory agar Dashboard Admin sinkron.'
  })
  @ApiResponse({ status: 200, description: 'Heartbeat acknowledged' })
  async sendHeartbeat(
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
    @GetUser('email') email: string, // Ganti dengan info yang relevan dari decoded token misal nama atau email sementara fallback
    @Body('deviceId') deviceId: string
  ) {
    if (!deviceId) deviceId = 'web-browser';
    // Gunakan email sementara kalo fullName ga ada di Decorator. Atau panggil profile dari cache kalau mau lebih complex
    await this.redisService.recordHeartbeat(userId, deviceId, role, email);
    return { ok: true };
  }
}