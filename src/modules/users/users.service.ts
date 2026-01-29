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
    // 1. Cek duplikat Email atau NIP
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { nip: dto.nip }],
      },
    });
    if (existing) {
      throw new BadRequestException('Email atau NIP sudah terdaftar');
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // 3. Prepare Data
    // Exclude field yang tidak ada di schema User (jobTitle)
    const { password, dateOfBirth, jobTitle, ...rest } = dto;

    const data: any = {
      ...rest, // Ini sudah membawa 'unitKerjaId' dan 'nip'
      passwordHash: hashedPassword,
    };

    if (dateOfBirth) {
      data.dateOfBirth = new Date(dateOfBirth);
    }

    try {
      const newUser = await this.prisma.user.create({ data });
      this.syncToSearch(newUser);
      const { passwordHash, ...result } = newUser;
      return result;
    } catch (error) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Unit Kerja ID tidak valid');
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { unitKerja: true },
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

  private async processUpdate(userId: string, dto: any) {
    try {
      const { password, dateOfBirth, dependentCount, jobTitle, ...restData } = dto;
      const updatePayload: any = { ...restData };

      if (dependentCount !== undefined) {
        updatePayload.dependentCount = Number(dependentCount);
      }
      if (dateOfBirth) {
        updatePayload.dateOfBirth = new Date(dateOfBirth);
      }
      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.passwordHash = await bcrypt.hash(password, salt);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
      });

      this.syncToSearch(updatedUser);
      const { passwordHash, ...result } = updatedUser;
      return result;
    } catch (error) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      if (error.code === 'P2003') throw new BadRequestException('Unit Kerja ID tidak valid');
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