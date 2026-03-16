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
    ParseUUIDPipe,
    HttpStatus,
    DefaultValuePipe,
    ParseIntPipe,
    ParseEnumPipe, // [PHASE 4 IMPORT]
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
    ApiQuery,
} from '@nestjs/swagger';

// Services & DTOs
import { UsersService } from '../users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

// Guards & Decorators
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';

@ApiTags('Admin User Management')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Security Gate: Hanya Admin yang bisa akses seluruh endpoint ini
@ApiBearerAuth()
export class AdminUsersController {
    constructor(private readonly usersService: UsersService) { }

    /**
     * Endpoint: GET /admin/users
     * Mengambil daftar user dengan fitur Pagination, Fuzzy Search (pg_trgm), dan Filter Role.
     */
    @Get()
    @ApiOperation({ summary: 'List All Agents/Users (Pagination & Fuzzy Search)' })
    @ApiResponse({ status: 200, description: 'Return list of users with pagination meta.' })
    @ApiQuery({ name: 'search', required: false, description: 'Fuzzy search by Name, Email, NIP, or Agency' })
    @ApiQuery({ name: 'role', enum: Role, required: false, description: 'Filter by Role' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
    async findAll(
        @Query('search') search?: string,
        // [PHASE 4 HARDENING] Menggunakan ParseEnumPipe untuk menjamin nilai yang masuk adalah Enum Prisma yang valid
        @Query('role', new ParseEnumPipe(Role, { optional: true })) role?: Role,
        // [PHASE 4 HARDENING] ParseIntPipe mencegah injeksi string yang dapat merusak "Skip" & "Take" Database
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
    ) {
        return this.usersService.findAll({ search, role, page, limit });
    }

    /**
     * Endpoint: POST /admin/users
     * Membuat user baru (Agent) secara manual oleh Admin.
     */
    @Post()
    @ApiOperation({ summary: 'Create New Agent/User Manually' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Agent successfully created.' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Email/NIP already exists.' })
    async create(
        @GetUser('id') adminId: string,
        @Body() createUserDto: CreateUserDto
    ) {
        return this.usersService.createUser(adminId, createUserDto);
    }

    /**
     * Endpoint: GET /admin/users/:id
     * Melihat detail lengkap user (Agency, Subscription, Quota, Analytics).
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get Agent Detail with Subscription & Quota Info' })
    @ApiResponse({ status: 200, description: 'User details retrieved.' })
    @ApiResponse({ status: 404, description: 'User not found.' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.findOne(id);
    }

    /**
     * Endpoint: PATCH /admin/users/:id
     * Mengupdate data profil user (Override penuh oleh Admin).
     */
    @Patch(':id')
    @ApiOperation({ summary: 'Update Agent Profile (Admin Override)' })
    @ApiResponse({ status: 200, description: 'User updated successfully.' })
    async update(
        @GetUser('id') adminId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        return this.usersService.updateUser(adminId, id, updateUserDto);
    }

    /**
     * Endpoint: DELETE /admin/users/:id
     * Menghapus user secara permanen dan menyingkirkannya dari indeks Meilisearch.
     */
    @Delete(':id')
    @ApiOperation({ summary: 'Delete Agent (and remove from Search Index)' })
    @ApiResponse({ status: 200, description: 'User deleted successfully.' })
    async remove(
        @GetUser('id') adminId: string,
        @Param('id', ParseUUIDPipe) id: string
    ) {
        return this.usersService.deleteUser(adminId, id);
    }
}