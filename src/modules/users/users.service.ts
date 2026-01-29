import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EditUserDto } from './dto/edit-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) { }

  // =================================================================
  // SELF-SERVICE (User Biasa)
  // =================================================================

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitKerja: true },
    });

    if (!user) throw new NotFoundException(`User not found`);

    const { passwordHash, ...result } = user;
    return result;
  }

  async editUser(userId: string, dto: EditUserDto) {
    this.logger.log(
      `User ${userId} editing self. Fields: ${Object.keys(dto).join(', ')}`,
    );
    return this.processUpdate(userId, dto);
  }

  // =================================================================
  // ADMIN FEATURES (Manajemen Pegawai)
  // =================================================================

  // 1. List Users (Search & Filter)
  async findAll(params: { search?: string; role?: Role }) {
    const { search, role } = params;
    const where: any = {};

    // Filter by Role
    if (role) {
      where.role = role;
    }

    // Filter by Search (Name / Email)
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        // jobTitle: true, // [REMOVED] Field ini tidak ada di schema.prisma
        unitKerja: {
          select: {
            namaUnit: true // [FIXED] Menggunakan namaUnit sesuai schema
          }
        },
        createdAt: true,
      },
    });
  }

  // 2. Create User (Admin)
  async createUser(dto: CreateUserDto) {
    // Cek duplikat email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new BadRequestException('Email already exists');

    // Hash Password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // Prepare Data
    // [FIX] Exclude jobTitle karena tidak ada di schema User
    const { password, dateOfBirth, jobTitle, ...rest } = dto;

    const data: any = {
      ...rest,
      passwordHash: hashedPassword,
    };

    if (dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth);
    }

    // Insert DB
    const newUser = await this.prisma.user.create({
      data,
    });

    // Sync Search
    this.syncToSearch(newUser);

    const { passwordHash, ...result } = newUser;
    return result;
  }

  // 3. Get Detail User (Admin)
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { unitKerja: true }, // Include relasi detail
    });

    if (!user) throw new NotFoundException('User not found');

    const { passwordHash, ...result } = user;
    return result;
  }

  // 4. Update User (Admin)
  async updateUser(id: string, dto: UpdateUserDto) {
    this.logger.log(`Admin updating user ${id}`);
    return this.processUpdate(id, dto);
  }

  // 5. Delete User (Admin)
  async deleteUser(id: string) {
    // Cek existensi
    await this.findOne(id);

    // Delete DB
    const deleted = await this.prisma.user.delete({
      where: { id },
    });

    // Hapus dari Search Index (Optional)
    // this.searchService.deleteDocument('global_search', id); 

    this.logger.log(`User ${id} deleted by Admin`);
    return { message: 'User deleted successfully', id: deleted.id };
  }

  // =================================================================
  // HELPERS (Shared Logic)
  // =================================================================

  /**
   * Helper untuk menangani update data (Parsing Date, Hashing Password, dll)
   * Digunakan oleh editUser (Self) dan updateUser (Admin)
   */
  private async processUpdate(userId: string, dto: any) {
    try {
      // [FIX] Exclude jobTitle karena tidak ada di schema
      const { password, dateOfBirth, dependentCount, jobTitle, ...restData } = dto;

      const updatePayload: any = { ...restData };

      // [FIX] Handle Dependent Count (Pastikan Int)
      if (dependentCount !== undefined) {
        updatePayload.dependentCount = Number(dependentCount);
      }

      // [FIX] Handle Date (String YYYY-MM-DD -> Date Object)
      if (dateOfBirth) {
        updatePayload.dateOfBirth = new Date(dateOfBirth);
      }

      // [FIX] Handle Password Hash (Jika ada request ganti password)
      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.passwordHash = await bcrypt.hash(password, salt);
      }

      // Update DB
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
      });

      // Sync Search Engine
      this.syncToSearch(updatedUser);

      // Return clean data
      const { passwordHash, ...result } = updatedUser;
      return result;
    } catch (error) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      throw error;
    }
  }

  private async syncToSearch(user: any) {
    try {
      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'PERSON',
        title: user.fullName,
        subtitle: user.email,
        role: user.role,
        unitKerjaId: user.unitKerjaId,
      };
      // Fire & Forget sync
      this.searchService
        .addDocuments('global_search', [searchPayload])
        .catch((e) => this.logger.warn(`Search sync error: ${e.message}`));
    } catch (error) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}