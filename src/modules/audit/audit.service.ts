import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // Fungsi untuk mencatat aktivitas
  async logActivity(actorId: string, action: string, metadata?: any) {
    return this.prisma.accessLog.create({
      data: {
        actorId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  }

  // Fungsi untuk Direksi melihat semua log
  async getAllLogs() {
    return this.prisma.accessLog.findMany({
      include: { actor: { select: { fullName: true, email: true, role: true } } },
      orderBy: { accessedAt: 'desc' },
      take: 50, // Ambil 50 terakhir
    });
  }
  
  // Fungsi Direksi melihat karyawan berisiko (Skor < 60)
  async getRiskyEmployees() {
    return this.prisma.financialCheckup.findMany({
      where: { status: 'BAHAYA' },
      include: { user: { select: { fullName: true, unitKerja: true } } },
      distinct: ['userId'], // Agar user yg sama tidak muncul berkali-kali
      orderBy: { checkDate: 'desc' },
    });
  }
}