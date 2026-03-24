import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RedisService } from '../redis/redis.service';
import { UsersService } from './users.service';
import { EditUserDto } from './dto/edit-user.dto';

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
    description: 'Mengambil data profil user yang sedang login, termasuk status Subscription dan sisa Kuota.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profil user berhasil diambil.',
  })
  getMe(@GetUser('id') userId: string) {
    // Sinkronisasi: Memastikan Service menarik single source of truth dari database
    return this.userService.getMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update My Profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profil berhasil diperbarui.',
  })
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    // [FASE 3] Keamanan: ID User diambil dari Token (Decoded JWT), bukan dari body request klien
    return this.userService.editUser(userId, dto);
  }

  // =================================================================
  // REAL-TIME HEARTBEAT PING
  // =================================================================

  @Post('heartbeat')
  @ApiOperation({
    summary: 'Send Online Heartbeat Pong',
    description: 'Endpoint ringan untuk menandakan user aktif di sistem menggunakan Redis.'
  })
  @ApiResponse({ status: 200, description: 'Heartbeat acknowledged' })
  async sendHeartbeat(
    @GetUser('id') userId: string,
    @GetUser('role') role: string,
    @GetUser('email') email: string,
    @Body('deviceId') deviceId: string
  ) {
    if (!deviceId) deviceId = 'web-browser';

    // Sinkronisasi Real-time: Mencatat status aktif user ke Redis
    await this.redisService.recordHeartbeat(userId, deviceId, role, email);
    return { ok: true };
  }
}