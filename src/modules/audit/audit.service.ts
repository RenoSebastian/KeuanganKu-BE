import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * MENCATAT JEJAK DIGITAL (AUDIT TRAIL)
   * Signature: logAccess(dto: CreateAuditLogDto) -> 1 Argument
   */
  async logAccess(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          actorId: dto.actorId,
          targetUserId: dto.targetUserId ?? null, // Handle jika undefined
          action: dto.action,
          metadata: dto.metadata ?? {},
        },
      });
    } catch (error) {
      // Fail-safe: Error log tidak boleh mematikan flow utama
      this.logger.error(
        `[AUDIT FAILURE] Failed to log action '${dto.action}' by ${dto.actorId}`, 
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  /**
   * READ: HISTORY LOG
   */
  async getAllLogs() {
    return this.prisma.accessLog.findMany({
      include: {
        actor: {
          select: { fullName: true, email: true, role: true },
        },
        targetUser: {
          select: { fullName: true, unitKerja: { select: { namaUnit: true } } },
        },
      },
      orderBy: { accessedAt: 'desc' },
      take: 100,
    });
  }
}