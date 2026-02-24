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
  constructor(private readonly userService: UsersService) { }

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

  @Get()
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Get All Users (Admin Only)' })
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: client.Role,
  ) {
    return this.userService.findAll({ search, role });
  }

  @Post()
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Create New User/Employee' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get(':id')
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Get Specific User Detail' })
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Update Specific User' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(client.Role.ADMIN)
  @ApiOperation({ summary: 'Delete User (Soft/Hard Delete)' })
  remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}