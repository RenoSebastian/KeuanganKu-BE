import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * MENCATAT JEJAK DIGITAL (AUDIT TRAIL)
   * Konsep: Fire-and-Forget (Non-blocking priority)
   * Logic: 
   * 1. Terima payload DTO.
   * 2. Lakukan insert ke DB secara asynchronous.
   * 3. Jika gagal, catat di console server (Logger) agar tidak men-crash request utama.
   */
  async logAccess(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.accessLog.create({
        data: {
          actorId: dto.actorId,
          targetUserId: dto.targetUserId ?? null, // Handle null explicitly
          action: dto.action,
          metadata: dto.metadata ?? {}, // Simpan sebagai JSON
        },
      });
    } catch (error) {
      // CRITICAL: Jangan throw error ke user! 
      // Kegagalan log tidak boleh membatalkan aksi bisnis (misal: view dashboard).
      // Cukup catat di internal system log.
      this.logger.error(
        `[AUDIT FAILURE] Failed to log action '${dto.action}' by ${dto.actorId}`, 
        error.stack
      );
    }
  }

  /**
   * READ: UNTUK KEBUTUHAN HALAMAN HISTORY LOG DIREKSI
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
      take: 100, // Limit 100 log terakhir demi performa
    });
  }

  // NOTE: getRiskyEmployees() dipindahkan ke FinancialService/DirectorService
  // untuk menjaga Single Responsibility Principle.
}