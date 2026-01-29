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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as client from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EditUserDto } from './dto/edit-user.dto';
import { UsersService } from './users.service';
// [NOTE] Pastikan Anda membuat file DTO ini di folder modules/users/dto/
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('Users')
@UseGuards(JwtAuthGuard, RolesGuard) // Menggunakan Guard Custom + Roles
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) { }

  // =================================================================
  // SELF-SERVICE (Untuk User Biasa mengelola akun sendiri)
  // =================================================================

  @Get('me')
  getMe(@GetUser() user: client.User) {
    return this.userService.getMe(user.id);
  }

  @Patch('me')
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    return this.userService.editUser(userId, dto);
  }

  // =================================================================
  // ADMIN ONLY (Manajemen Pegawai)
  // =================================================================

  @Get()
  @Roles(client.Role.ADMIN)
  findAll(@Query('search') search?: string, @Query('role') role?: client.Role) {
    return this.userService.findAll({ search, role });
  }

  @Post()
  @Roles(client.Role.ADMIN)
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  @Get(':id')
  @Roles(client.Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(client.Role.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(client.Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }
}