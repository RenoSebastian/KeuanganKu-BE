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
   */
  async logAdminAction(data: {
    adminId: string;
    action: string;
    targetUserId: string; // Bisa berupa User ID atau 'SYSTEM'
    details: Record<string, any>;
    ip?: string;
  }) {
    try {
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
   */
  async logAccess(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          actorId: dto.actorId,
          targetUserId: dto.targetUserId ?? null,
          action: dto.action,
          metadata: (dto.metadata as Prisma.InputJsonValue) ?? {},
        },
      });
    } catch (error) {
      this.logger.error(
        `[AUDIT FAILURE] Failed to log action '${dto.action}' by ${dto.actorId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * [PHASE 3 ENHANCEMENT: HIGH-PERFORMANCE LOG VIEWER]
   * Menggunakan Cursor-Based Pagination. O(1) jump time.
   */
  async getAdminSystemLogs(params: {
    cursor?: string;
    take: number;
    action?: string;
  }) {
    const { cursor, take, action } = params;

    const where: Prisma.AdminActivityLogWhereInput = {};

    if (action) {
      where.actionType = action;
    }

    // Mengambil (take + 1) baris. Baris ekstra ini hanya digunakan 
    // untuk memeriksa apakah data selanjutnya (nextCursor) tersedia.
    const logs = await this.prisma.adminActivityLog.findMany({
      take: take + 1,
      // Jika ada cursor, lewati record cursor itu sendiri (skip: 1)
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where,
      include: {
        admin: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' }, // Terbaru selalu di atas
    });

    let nextCursor: string | undefined = undefined;

    // Jika jumlah data yang kembali lebih besar dari "take" yang diminta, 
    // berarti ada data di halaman berikutnya.
    if (logs.length > take) {
      const nextItem = logs.pop(); // Buang item ekstra dari array return
      nextCursor = nextItem!.id;   // Jadikan ID item ekstra sebagai cursor selanjutnya
    }

    return {
      data: logs,
      meta: {
        nextCursor,
        hasMore: nextCursor !== undefined,
        limit: take,
      },
    };
  }

  /**
   * [READ] GENERAL LOGS (Fallback)
   */
  async getAllLogs(limit: number) {
    return this.prisma.accessLog.findMany({
      include: {
        actor: {
          select: { fullName: true, email: true, role: true },
        },
        targetUser: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { accessedAt: 'desc' },
      take: limit,
    });
  }
}