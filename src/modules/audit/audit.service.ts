import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * [PUBLIC ADAPTER] GENERAL USER ACTIVITY
   * Mencatat aktivitas rutin user (Login, View, Simulasi) ke tabel AccessLog.
   */
  async logActivity(data: {
    userId: string;
    action: string;
    entity?: string;
    entityId?: string;
    details?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const payload: CreateAuditLogDto = {
      actorId: data.userId,
      action: data.action,
      targetUserId: undefined,
      metadata: {
        context: 'USER_ACTIVITY',
        entity: data.entity,
        entityId: data.entityId,
        details: data.details,
        ip: data.ip,
        userAgent: data.userAgent,
        timestamp: new Date().toISOString(),
      },
    };

    return this.logAccess(payload);
  }

  /**
   * [PUBLIC ADAPTER] ADMIN CORE ACTIONS
   * Mencatat tindakan administratif sensitif ke tabel AdminActivityLog.
   * Mendukung penyimpanan struktur 'changes' (Before vs After) untuk audit trail.
   */
  async logAdminAction(data: {
    adminId: string;
    action: string;
    targetUserId: string; // Bisa berupa User ID atau 'SYSTEM'
    details: Record<string, any>;
    ip?: string;
  }) {
    try {
      // Tentukan Entity Name berdasarkan target
      let entityName = 'USER';
      if (data.targetUserId === 'SYSTEM') entityName = 'SYSTEM';
      if (data.details.entityName) entityName = data.details.entityName;

      await this.prisma.adminActivityLog.create({
        data: {
          adminId: data.adminId,
          actionType: data.action,
          entityName: entityName,
          entityId: data.targetUserId !== 'SYSTEM' ? data.targetUserId : null,
          changes: data.details as Prisma.InputJsonValue,
          ipAddress: data.ip,
        },
      });
    } catch (error) {
      this.logger.error(
        `[AUDIT FAILURE] Failed to log Admin action '${data.action}' by ${data.adminId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * [CORE LOGIC] DB WRITER (Access Logs)
   * Menyimpan log aktivitas umum.
   */
  async logAccess(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          actorId: dto.actorId,
          targetUserId: dto.targetUserId ?? null,
          action: dto.action,
          // Menggunakan tipe Prisma.InputJsonValue untuk keamanan tipe data JSON
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? {},
        },
      });
    } catch (error) {
      // Fail-safe: Error logging tidak boleh mematikan flow aplikasi utama
      this.logger.error(
        `[AUDIT FAILURE] Failed to log action '${dto.action}' by ${dto.actorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * [READ] DASHBOARD ANALYTICS (User Logs)
   * Mengambil log aktivitas user biasa.
   */
  async getAllLogs(limit = 100) {
    return this.prisma.accessLog.findMany({
      include: {
        actor: {
          select: {
            fullName: true,
            email: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        accessedAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * [READ] ADMIN SPECIFIC LOGS
   * Mengambil log aktivitas khusus Admin dari tabel AdminActivityLog.
   */
  async getAdminLogs(limit = 50) {
    return this.prisma.adminActivityLog.findMany({
      include: {
        admin: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}