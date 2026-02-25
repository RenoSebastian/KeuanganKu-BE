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
   * Wrapper untuk memudahkan logging aktivitas user biasa.
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
   * Wrapper khusus untuk Admin SaaS (Approval, Banned, Inject Quota).
   */
  async logAdminAction(data: {
    adminId: string;
    action: string;
    targetUserId: string;
    details: Record<string, any>;
    ip?: string;
  }) {
    const payload: CreateAuditLogDto = {
      actorId: data.adminId,
      action: data.action,
      targetUserId: data.targetUserId,
      metadata: {
        context: 'ADMIN_ACTION',
        ...data.details,
        ip: data.ip,
        timestamp: new Date().toISOString(),
      },
    };

    return this.logAccess(payload);
  }

  /**
   * [CORE LOGIC] DB WRITER
   * NOTE: Method ini dibuat PUBLIC (bukan private) karena masih dipanggil langsung
   * oleh 'AuditInterceptor' dan 'DirectorService'.
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
   * [READ] DASHBOARD ANALYTICS
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
   */
  async getAdminLogs(limit = 50) {
    return this.prisma.accessLog.findMany({
      where: {
        actor: {
          role: 'ADMIN',
        },
      },
      include: {
        actor: { select: { fullName: true, email: true } },
        targetUser: { select: { fullName: true, email: true } },
      },
      orderBy: { accessedAt: 'desc' },
      take: limit,
    });
  }
}