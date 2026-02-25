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
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
  ) { }

  // =================================================================
  // SELF-SERVICE (User Profile & Context)
  // =================================================================

  /**
   * Mengambil profil user yang sedang login beserta:
   * 1. Data Unit Kerja
   * 2. Status Subscription (Plan & Validity)
   * 3. Sisa Kuota Simulasi (UserUsage)
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        unitKerja: true,
        // [INTEGRATION] Load Quota Data untuk Logic Blocking di FE
        usage: true,
        // [INTEGRATION] Load Status Langganan untuk Fitur PRO
        subscription: {
          include: {
            plan: true, // Sertakan detail nama paket (Monthly/Yearly)
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User profile not found`);

    // Sanitize: Hapus password hash sebelum dikirim ke client
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
  // ADMIN FEATURES (Manajemen Pegawai & Monitoring)
  // =================================================================

  // 1. List Users (Search & Filter)
  async findAll(params: { search?: string; role?: Role }) {
    const { search, role } = params;
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Mengambil list user dengan data ringkas untuk tabel Admin
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        unitKerja: {
          select: { namaUnit: true, kodeUnit: true },
        },
        usage: true, // Admin perlu lihat siapa yang kuotanya habis
        subscription: {
          select: { status: true, plan: { select: { name: true } } },
        },
      },
    });

    // Mapping result agar lebih rapi (optional, tergantung kebutuhan UI table)
    return users.map((u) => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
  }

  // 2. Create User (Admin / Registration Handler)
  async createUser(dto: CreateUserDto) {
    // Cek duplikasi Email atau NIP
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { nip: dto.nip }],
      },
    });

    if (existing) {
      throw new BadRequestException('Email atau NIP sudah terdaftar dalam sistem.');
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // Pisahkan field khusus yang butuh processing manual
    const { password, dateOfBirth, ...rest } = dto;

    // Persiapkan Payload Database
    const data: any = {
      ...rest,
      passwordHash: hashedPassword,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,

      // [CRITICAL] Inisialisasi Token Bucket (Quota) untuk User Baru
      // Setiap user baru mendapat 3 Token Gratis (Configurable)
      usage: {
        create: {
          simulationQuota: 10,
          totalUsed: 0,
        },
      },
    };

    try {
      const newUser = await this.prisma.user.create({
        data,
        include: {
          usage: true, // Return usage agar FE bisa langsung update state
        },
      });

      // Sync ke Meilisearch (Async agar tidak block response)
      this.syncToSearch(newUser).catch((err) =>
        this.logger.error(`Failed to sync new user to search: ${err.message}`),
      );

      const { passwordHash, ...result } = newUser;
      return result;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Unit Kerja ID tidak valid atau tidak ditemukan.');
      }
      this.logger.error(`Create user failed: ${error.message}`);
      throw error;
    }
  }

  // 3. Get Detail (Admin View)
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        unitKerja: true,
        usage: true,        // Admin perlu memantau pemakaian user
        subscription: {     // Admin perlu memantau status langganan
          include: {
            plan: true,
            lastOrder: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User data not found');

    const { passwordHash, ...result } = user;
    return result;
  }

  // 4. Update User (Admin)
  async updateUser(id: string, dto: UpdateUserDto) {
    return this.processUpdate(id, dto);
  }

  // 5. Delete User (Admin)
  async deleteUser(id: string) {
    // Pastikan user ada sebelum delete
    await this.findOne(id);

    try {
      const deleted = await this.prisma.user.delete({ where: { id } });

      // Hapus juga dari index pencarian
      this.searchService
        .removeDocument('global_search', id)
        .catch((e) => this.logger.warn(`Search removal warning: ${e.message}`));

      return { message: 'User deleted successfully', id: deleted.id };
    } catch (error: any) {
      this.logger.error(`Delete user failed: ${error.message}`);
      throw new BadRequestException(
        'Gagal menghapus user, mungkin masih memiliki relasi data penting.',
      );
    }
  }

  // =================================================================
  // HELPERS (Shared Logic)
  // =================================================================

  private async processUpdate(userId: string, dto: any) {
    try {
      const { password, dateOfBirth, dependentCount, ...restData } = dto;

      const updatePayload: any = {};

      // Dynamic field mapping
      Object.keys(restData).forEach((key) => {
        if (restData[key] !== undefined && restData[key] !== '') {
          updatePayload[key] = restData[key];
        }
      });

      // Handle Numeric Fields
      if (dependentCount !== undefined) {
        updatePayload.dependentCount = Number(dependentCount);
      }

      // Handle Date Fields
      if (dateOfBirth) {
        updatePayload.dateOfBirth = new Date(dateOfBirth);
      }

      // Handle Password Hashing (Jika ada perubahan password)
      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.passwordHash = await bcrypt.hash(password, salt);
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
        include: {
          usage: true,
          subscription: true,
        },
      });

      // Update Search Index
      this.syncToSearch(updatedUser).catch((e) =>
        this.logger.warn(`Search update warning: ${e.message}`),
      );

      const { passwordHash, ...result } = updatedUser;
      return result;
    } catch (error: any) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      if (error.code === 'P2003')
        throw new BadRequestException('Unit Kerja ID tidak valid');
      throw error;
    }
  }

  private async syncToSearch(user: any) {
    try {
      // Payload disesuaikan dengan skema index Meilisearch
      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'PERSON',
        title: user.fullName,
        subtitle: user.email,
        role: user.role,
        unitKerjaId: user.unitKerjaId,
        agentLevel: user.agentLevel,
        agencyName: user.agencyName,
        address: user.address,
        gender: user.gender,
        companyName: user.companyName,
        goals: user.goals,
        // Optional: Tambahkan flag isPro untuk filtering di search
        isPro: user.subscription?.status === 'ACTIVE',
      };

      await this.searchService.addDocuments('global_search', [searchPayload]);
    } catch (error: any) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}