import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EditUserDto } from './dto/edit-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly auditService: AuditService,
  ) { }

  // =================================================================
  // SELF-SERVICE (User Profile & Context)
  // =================================================================

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        agency: true,
        usage: true,
        subscription: {
          include: {
            plan: true,
          },
        },
        _count: {
          select: {
            simulationLogs: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User profile not found`);

    const { passwordHash, ...result } = user;
    return result;
  }

  async editUser(userId: string, dto: EditUserDto) {
    this.logger.log(`User ${userId} editing self. Fields: ${Object.keys(dto).join(', ')}`);
    return this.processUpdate(userId, dto);
  }

  // =================================================================
  // ADMIN FEATURES (Manajemen Agen & Monitoring)
  // =================================================================

  /**
   * List Users dengan Advanced Fuzzy Search (pg_trgm)
   */
  async findAll(params: {
    search?: string;
    role?: Role;
    page?: number;
    limit?: number;
  }) {
    const { search, role, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    // [PHASE 2: ENHANCEMENT] Optimasi Trigram Fuzzy Search
    if (search && search.trim() !== '') {
      const searchStr = search.trim();
      // Step 1: Tarik ID yang memiliki probabilitas kemiripan teks menggunakan GiST Index
      // Menggunakan threshold SIMILARITY > 0.15 agar toleran terhadap typo minor
      const matchedRecords = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User"
        WHERE "fullName" % ${searchStr}
           OR "email" ILIKE ${'%' + searchStr + '%'}
           OR "nip" ILIKE ${'%' + searchStr + '%'}
           OR SIMILARITY("fullName", ${searchStr}) > 0.15
        ORDER BY SIMILARITY("fullName", ${searchStr}) DESC
      `;

      const matchedIds = matchedRecords.map(r => r.id);

      // Jika tidak ada yang match sama sekali, jangan buang resource untuk Step 2
      if (matchedIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, lastPage: 0 },
        };
      }

      // Filter array IDs untuk Step 2
      where.id = { in: matchedIds };
    }

    // Step 2: Main Query dengan pagination & Relasional Include
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: search ? undefined : { createdAt: 'desc' }, // Jika search, pertahankan urutan kemiripan dari DB
        include: {
          agency: {
            select: { name: true, code: true },
          },
          usage: true,
          subscription: {
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

  async createUser(adminId: string, dto: CreateUserDto) {
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

    const { password, dateOfBirth, agencyId, ...rest } = dto;

    try {
      const newUser = await this.prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            ...rest,
            passwordHash: hashedPassword,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            agencyId: agencyId || null,
            usage: {
              create: {
                simulationQuota: 3,
                totalUsed: 0,
              },
            },
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

      this.syncToSearch(newUser).catch((err) =>
        this.logger.error(`Failed to sync new user to search: ${err.message}`),
      );

      const { passwordHash, ...result } = newUser;

      // Log keamananan untuk creation
      this.auditService.logAdminAction({
        adminId,
        action: 'CREATE_USER',
        targetUserId: result.id,
        details: { entityName: 'USER', before: null, after: result }
      }).catch(e => this.logger.warn(`Audit logging failed: ${e.message}`));

      return result;
    } catch (error: any) {
      if (error.code === 'P2003') throw new BadRequestException('Agency ID tidak valid atau tidak ditemukan.');
      this.logger.error(`Create user failed: ${error.message}`);
      throw error;
    }
  }

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

  async updateUser(adminId: string, id: string, dto: UpdateUserDto) {
    return this.processUpdate(id, dto, adminId);
  }

  async deleteUser(adminId: string, id: string) {
    const oldData = await this.findOne(id);

    try {
      const deleted = await this.prisma.user.delete({ where: { id } });

      this.searchService
        .removeDocument('global_search', id)
        .catch((e) => this.logger.warn(`Search removal warning: ${e.message}`));

      this.auditService.logAdminAction({
        adminId,
        action: 'DELETE_USER',
        targetUserId: id,
        details: { entityName: 'USER', before: oldData, after: null }
      }).catch(e => this.logger.warn(`Audit logging failed: ${e.message}`));

      return { message: 'User deleted successfully', id: deleted.id };
    } catch (error: any) {
      this.logger.error(`Delete user failed: ${error.message}`);
      throw new BadRequestException('Gagal menghapus user. Pastikan user tidak memiliki data tagihan aktif.');
    }
  }

  // =================================================================
  // HELPER METHODS
  // =================================================================

  private async processUpdate(userId: string, dto: any, adminId?: string) {
    try {
      const oldUser = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!oldUser) throw new NotFoundException('User not found');

      const { passwordHash: oldHash, ...oldSanitized } = oldUser;
      const { password, dateOfBirth, dependentCount, agencyId, agencyName, ...restData } = dto;

      const updatePayload: any = { ...restData };

      if (dependentCount !== undefined) updatePayload.dependentCount = Number(dependentCount);
      if (dateOfBirth) updatePayload.dateOfBirth = new Date(dateOfBirth);
      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.passwordHash = await bcrypt.hash(password, salt);
      }
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

      this.syncToSearch(updatedUser).catch((e) =>
        this.logger.warn(`Search update warning: ${e.message}`),
      );

      const { passwordHash, ...result } = updatedUser;

      if (adminId) {
        // [PHASE 2: ENHANCEMENT] Detailed Update Logging
        this.auditService.logAdminAction({
          adminId,
          action: 'UPDATE_USER',
          targetUserId: result.id,
          details: {
            entityName: 'USER',
            before: oldSanitized,
            after: result,
            changes: dto,
          }
        }).catch(e => this.logger.warn(`Audit logging failed: ${e.message}`));
      }

      return result;
    } catch (error: any) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      if (error.code === 'P2003') throw new BadRequestException('Agency ID tidak valid');
      throw error;
    }
  }

  private async syncToSearch(user: any) {
    try {
      const isPro = user.subscription?.status === 'ACTIVE';

      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'AGENT',
        title: user.fullName,
        subtitle: user.email,
        description: user.agency?.name || user.companyName || 'Independent Agent',
        role: user.role,
        agencyId: user.agencyId,
        agentLevel: user.agentLevel,
        isPro: isPro,
        location: user.address,
        goals: user.goals,
      };

      await this.searchService.addDocuments('global_search', [searchPayload]);
    } catch (error: any) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}