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
   * Mengambil profil user yang sedang login beserta context SaaS:
   * 1. Data Agency (dahulu Unit Kerja)
   * 2. Status Subscription (Active Plan)
   * 3. Sisa Kuota (UserUsage)
   * 4. Statistik Simulasi
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        // [REFACTOR] Menggunakan relasi Agency (SaaS Model)
        agency: true,
        // [INTEGRATION] Load Quota Data untuk Logic Blocking di FE
        usage: true,
        // [INTEGRATION] Load Data Langganan (1-to-1)
        subscription: {
          include: {
            plan: true,
          },
        },
        // [ANALYTICS] Hitung total report yang pernah dibuat
        _count: {
          select: {
            simulationLogs: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User profile not found`);

    // Sanitize: Hapus password hash
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
  // ADMIN FEATURES (Manajemen Agen & Monitoring)
  // =================================================================

  // 1. List Users (Search & Filter)
  async findAll(params: {
    search?: string;
    role?: Role;
    page?: number;
    limit?: number;
  }) {
    const { search, role, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nip: { contains: search, mode: 'insensitive' } },
        // Support pencarian berdasarkan nama agency
        { agency: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agency: {
            select: { name: true, code: true },
          },
          usage: true, // Admin perlu lihat sisa kuota user
          subscription: {
            // [FIX] Hapus 'orderBy' dan 'take' karena relasi One-to-One
            select: {
              status: true,
              endDate: true,
              plan: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => {
        const { passwordHash, ...rest } = u;
        return rest;
      }),
      meta: {
        total,
        page,
        limit,
        lastPage: Math.ceil(total / limit),
      },
    };
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
      throw new BadRequestException(
        'Email atau NIP sudah terdaftar dalam sistem.',
      );
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    // Destructure field DTO
    const { password, dateOfBirth, agencyId, ...rest } = dto;

    try {
      // Menggunakan Transaction untuk Data Consistency
      const newUser = await this.prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            ...rest,
            passwordHash: hashedPassword,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            agencyId: agencyId || null,

            // [CRITICAL] Inisialisasi Token Bucket (Quota) untuk User Baru
            // Default: 3 Token Gratis (Configurable)
            usage: {
              create: {
                simulationQuota: 3,
                totalUsed: 0,
              },
            },
            // [NEW] Inisialisasi Ledger Awal (Bonus Welcome)
            quotaLedger: {
              create: {
                amount: 3,
                type: 'ADMIN_BONUS',
                balanceAfter: 3,
                description: 'Welcome Bonus',
              },
            },
          },
          include: {
            usage: true,
            agency: true,
          },
        });
      });

      // Sync ke Meilisearch (Async agar tidak block response)
      this.syncToSearch(newUser).catch((err) =>
        this.logger.error(`Failed to sync new user to search: ${err.message}`),
      );

      const { passwordHash, ...result } = newUser;
      return result;
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException(
          'Agency ID tidak valid atau tidak ditemukan.',
        );
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
        agency: true,
        usage: true,
        subscription: {
          include: {
            plan: true,
            lastOrder: true,
          },
        },
        _count: {
          select: { simulationLogs: true },
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
    await this.findOne(id); // Ensure exists

    try {
      const deleted = await this.prisma.user.delete({ where: { id } });

      // Hapus document dari Search Engine
      this.searchService
        .removeDocument('global_search', id)
        .catch((e) => this.logger.warn(`Search removal warning: ${e.message}`));

      return { message: 'User deleted successfully', id: deleted.id };
    } catch (error: any) {
      this.logger.error(`Delete user failed: ${error.message}`);
      throw new BadRequestException(
        'Gagal menghapus user. Pastikan user tidak memiliki data tagihan aktif.',
      );
    }
  }

  // =================================================================
  // HELPER METHODS
  // =================================================================

  private async processUpdate(userId: string, dto: any) {
    try {
      const { password, dateOfBirth, dependentCount, agencyId, ...restData } =
        dto;

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

      // Handle Agency Change
      if (agencyId !== undefined) {
        updatePayload.agencyId = agencyId === '' ? null : agencyId;
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
        include: {
          agency: true,
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
        throw new BadRequestException('Agency ID tidak valid');
      throw error;
    }
  }

  /**
   * Menyinkronkan data user ke Meilisearch/Algolia
   * Mapping field disesuaikan dengan kebutuhan pencarian SaaS
   */
  private async syncToSearch(user: any) {
    try {
      // [FIX] Perbaikan logika check isPro untuk relasi One-to-One
      const isPro = user.subscription?.status === 'ACTIVE';

      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'AGENT', // Tipe dokumen untuk search filter
        title: user.fullName,
        subtitle: user.email,
        description:
          user.agency?.name || user.companyName || 'Independent Agent',
        role: user.role,
        // Facets untuk filtering
        agencyId: user.agencyId,
        agentLevel: user.agentLevel,
        isPro: isPro,
        location: user.address,
        goals: user.goals, // Bisa dicari berdasarkan goals (e.g., "MDRT")
      };

      await this.searchService.addDocuments('global_search', [searchPayload]);
    } catch (error: any) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}