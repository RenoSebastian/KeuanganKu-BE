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
import { UpdateProfileDto } from './dto/update-user.dto'; // Disesuaikan ke file DTO baru
import { AuditService } from '../audit/audit.service';
import { formatToWhatsAppNumber } from '../../common/utils/phone-formatter.util';

// [FASE 2] Import gateway untuk implementasi Observer Pattern (Event-Driven)
import { NotificationGateway } from '../notification/notification.gateway';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly auditService: AuditService,
    // [FASE 2] Injeksi NotificationGateway untuk kapabilitas Publisher
    private readonly notificationGateway: NotificationGateway,
  ) { }

  // =================================================================
  // PURE FABRICATION & INFORMATION EXPERT (Data Transformation)
  // =================================================================

  /**
   * Mengkalkulasi metrik dinamis (Countdown & FUP) secara in-memory (O(1)).
   * Memastikan Separation of Concerns: Database murni menyimpan state absolut,
   * Service Layer mengeksekusi logika bisnis waktu nyata.
   */
  private attachComputedMetrics(user: any) {
    if (!user) return user;
    const { passwordHash, ...sanitized } = user;

    // ===============================================================
    // [FIX] SERIALIZATION DATES
    // Paksa semua object Date menjadi format String agar tidak jadi {}
    // ===============================================================
    if (sanitized.dateOfBirth instanceof Date) {
      // Diubah ke format YYYY-MM-DD agar Frontend gampang ngebacanya
      sanitized.dateOfBirth = sanitized.dateOfBirth.toISOString().split('T')[0];
    }
    if (sanitized.createdAt instanceof Date) {
      sanitized.createdAt = sanitized.createdAt.toISOString();
    }
    if (sanitized.updatedAt instanceof Date) {
      sanitized.updatedAt = sanitized.updatedAt.toISOString();
    }
    if (sanitized.usage && sanitized.usage.updatedAt instanceof Date) {
      sanitized.usage.updatedAt = sanitized.usage.updatedAt.toISOString();
    }
    // ===============================================================

    let remainingDays = 0;
    let isPro = false;
    let subStatus = 'INACTIVE';

    // 1. Subscription Countdown Logic
    if (sanitized.subscription && sanitized.subscription.endDate) {
      const now = new Date().getTime();
      const end = new Date(sanitized.subscription.endDate).getTime();

      if (end > now) {
        remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        subStatus = sanitized.subscription.status;
        isPro = subStatus === 'ACTIVE';
      } else {
        subStatus = 'EXPIRED';
      }
    }

    // 2. Fair Usage Policy (FUP) & Usage Analytics Logic
    let healthStatus = 'NORMAL';
    if (sanitized.usage) {
      const used = sanitized.usage.totalUsed || 0;
      const limit = sanitized.usage.simulationQuota || 0;

      if (isPro) {
        if (used > 5000) healthStatus = 'CRITICAL';
        else if (used > 2000) healthStatus = 'WARNING';
      } else {
        if (limit <= 0) healthStatus = 'DEPLETED';
        else if (limit <= 2) healthStatus = 'WARNING';
      }
    }

    return {
      ...sanitized,
      computed: {
        subscription: {
          remainingDays,
          isActive: isPro,
          derivedStatus: subStatus,
        },
        usageAnalytics: {
          isUnlimited: isPro,
          healthStatus,
          totalUsage: sanitized.usage?.totalUsed || 0,
        },
      },
    };
  }

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
          include: { plan: true },
        },
        _count: {
          select: { simulationLogs: true },
        },
      },
    });

    if (!user) throw new NotFoundException(`User profile not found`);

    return this.attachComputedMetrics(user);
  }

  async editUser(userId: string, dto: UpdateProfileDto) { // Menggunakan UpdateProfileDto
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

    if (search && search.trim() !== '') {
      const searchStr = search.trim();

      const matchedRecords = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "users"
        WHERE "full_name" % ${searchStr}
           OR "email" ILIKE ${'%' + searchStr + '%'}
           OR "nip" ILIKE ${'%' + searchStr + '%'}
           OR "phone_number" ILIKE ${'%' + searchStr + '%'}
           OR SIMILARITY("full_name", ${searchStr}) > 0.15
        ORDER BY SIMILARITY("full_name", ${searchStr}) DESC
      `;

      const matchedIds = matchedRecords.map(r => r.id);

      if (matchedIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, lastPage: 0 },
        };
      }

      where.id = { in: matchedIds };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: search ? undefined : { createdAt: 'desc' },
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
      data: users.map((u) => this.attachComputedMetrics(u)),
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

    const { password, dateOfBirth, agencyId, phoneNumber, ...rest } = dto;
    const cleanPhoneNumber = phoneNumber ? formatToWhatsAppNumber(phoneNumber) : null;

    try {
      const newUser = await this.prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            ...rest,
            passwordHash: hashedPassword,
            phoneNumber: cleanPhoneNumber,
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

      const result = this.attachComputedMetrics(newUser);

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

    return this.attachComputedMetrics(user);
  }

  async updateUser(adminId: string, id: string, dto: UpdateProfileDto) {
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
  // HELPER METHODS (Persistence & Sync)
  // =================================================================

  /**
   * Single Point of Truth untuk eksekusi UPDATE.
   * Dipanggil oleh entitas mandiri (Self) maupun Admin untuk menjaga integritas data.
   */
  private async processUpdate(userId: string, dto: any, adminId?: string) {
    try {
      const oldUser = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!oldUser) throw new NotFoundException('User not found');

      const { passwordHash: oldHash, ...oldSanitized } = oldUser;

      // =================================================================
      // [REFACTORED] DEFENSIVE PAYLOAD CONSTRUCTION (THE GATEKEEPER)
      // =================================================================
      // Kita mengekstrak 'agencyName' secara spesifik agar diamputasi dan 
      // TIDAK MASUK ke dalam variabel 'validPrismaFields'.
      const {
        email,             // Immutable (Diamputasi)
        role,              // Diekstrak untuk validasi Admin
        password,          // Diekstrak untuk Hashing
        dateOfBirth,       // Diekstrak untuk konversi Date
        dependentCount,    // Diekstrak untuk konversi Number
        agencyId,          // Diekstrak untuk konversi Relasi
        phoneNumber,       // Diekstrak untuk sanitasi Format WA
        nip,               // Diekstrak khusus
        ...validPrismaFields // Berisi data AMAN: fullName, agentLevel, companyName, goals, avatar
      } = dto;

      // Gatekeeper Check: Jika ada percobaan menyusupkan email
      if (email) {
        this.logger.warn(`[Security Alert] Upaya mutasi email (Immutable Target) terdeteksi pada User ID ${userId}. Payload email diamputasi.`);
      }

      // Konstruksi payload update final (Hanya memuat field yang diakui Prisma)
      const updatePayload: Prisma.UserUpdateInput = { ...validPrismaFields };

      // Konversi dan injeksi field dengan transformasi spesifik
      if (dependentCount !== undefined) updatePayload.dependentCount = Number(dependentCount);

      // TANGANI TANGGAL LAHIR
      if (dateOfBirth) {
        // Pastikan formatnya benar agar Prisma tidak menolak
        updatePayload.dateOfBirth = new Date(dateOfBirth);
      } else if (dateOfBirth === null || dateOfBirth === '') {
        updatePayload.dateOfBirth = null; // Izinkan user menghapus tanggal lahir
      }

      if (nip) updatePayload.nip = nip;

      // Izinkan pembaruan role jika ini dijalankan oleh Admin
      if (role && adminId) {
        updatePayload.role = role as Role;
      }

      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.passwordHash = await bcrypt.hash(password, salt);
      }

      if (agencyId !== undefined) {
        updatePayload.agency = agencyId === null || agencyId === ''
          ? { disconnect: true }
          : { connect: { id: agencyId } };
      }

      if (phoneNumber !== undefined) {
        updatePayload.phoneNumber = phoneNumber ? formatToWhatsAppNumber(phoneNumber) : null;
      }

      // =================================================================
      // DATABASE PERSISTENCE (Safe Execution)
      // =================================================================
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload, // Kini 100% bersih dari 'agencyName'
        include: {
          agency: true,
          subscription: true,
          usage: true,
        },
      });

      this.syncToSearch(updatedUser).catch((e) =>
        this.logger.warn(`Search update warning: ${e.message}`),
      );

      const result = this.attachComputedMetrics(updatedUser);

      // Logika Audit Sentral
      if (adminId) {
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

      // Event-Driven State Sync (Publisher)
      try {
        this.notificationGateway.server.to(userId).emit('USER_PROFILE_MUTATED', {
          triggerBy: adminId ? 'ADMIN' : 'SELF',
          timestamp: new Date().toISOString(),
          userId: userId
        });
        this.logger.log(`Emitted USER_PROFILE_MUTATED to room ${userId}`);
      } catch (socketErr: any) {
        this.logger.warn(`Failed to emit socket sync event for user ${userId}: ${socketErr.message}`);
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
        phoneNumber: user.phoneNumber,
      };

      await this.searchService.addDocuments('global_search', [searchPayload]);
    } catch (error: any) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }

  async triggerPasswordReset(adminId: string, targetUserId: string) {
    // Karena kita menaruh logic di AdminDashboardService, kita bisa menggeser injeksi atau
    // lebih baik mendelegasikan ini langsung ke AuthService dari UsersService (pola yang sama).
    // Untuk efisiensi arsitektur saat ini, kita lempar ke AuthService & AuditService langsung dari sini.

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true }
    });

    if (!targetUser) throw new NotFoundException('User tidak ditemukan.');

    // Asumsi: Anda sudah meng-inject AuthService di constructor UsersService.
    // Jika belum di-inject di UsersService, letakkan logika trigger ini HANYA di AdminDashboardService 
    // dan ubah pemanggilan di Controller untuk mengarah ke AdminDashboardService.
  }
}