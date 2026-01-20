import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // Guard bawaan Passport
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { EditUserDto } from './dto/edit-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@UseGuards(AuthGuard('jwt')) // KUNCI: Endpoint ini butuh Login
@ApiBearerAuth() // Info ke Swagger butuh Token
@Controller('users')
export class UsersController {
  constructor(private userService: UsersService) {}

  @Get('me')
  getMe(@GetUser() user: User) {
    return this.userService.getMe(user.id);
  }

  @Patch('me')
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    return this.userService.editUser(userId, dto);
  }
}