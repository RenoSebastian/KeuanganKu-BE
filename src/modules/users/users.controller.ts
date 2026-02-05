import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto'; // [NEW] DTO Fase 3

@ApiTags('Users')
@UseGuards(JwtAuthGuard, RolesGuard) // Guard Global untuk Controller ini
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // =================================================================
  // SELF-SERVICE (Agen Mengelola Akun Sendiri)
  // =================================================================

  @Get('me')
  @ApiOperation({ summary: 'Ambil detail profil user yang sedang login' })
  @ApiResponse({ status: 200, description: 'Berhasil mengambil data profil.' })
  getMe(@GetUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Lengkapi data profil agen (Gradual Completion)' })
  @ApiResponse({ status: 200, description: 'Profil berhasil diperbarui.' })
  @ApiResponse({ status: 400, description: 'Validasi data gagal.' })
  updateProfile(
    @GetUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    // Memanggil method khusus updateProfile di service
    return this.usersService.updateProfile(userId, dto);
  }

  // =================================================================
  // ADMIN ONLY (Manajemen Agen)
  // =================================================================

  @Get()
  @Roles(Role.ADMIN, Role.DIRECTOR) // Hanya Admin & Direktur
  @ApiOperation({ summary: 'List semua user dengan filter pencarian (Admin)' })
  findAll(@Query('search') search?: string, @Query('role') role?: Role) {
    return this.usersService.findAll({ search, role });
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin membuat user baru secara manual' })
  @ApiResponse({ status: 201, description: 'User berhasil dibuat.' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DIRECTOR)
  @ApiOperation({ summary: 'Admin melihat detail user lain' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin mengedit data user lain' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin menghapus user (Soft/Hard delete logic di service)' })
  remove(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}