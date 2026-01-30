import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IRetentionStrategy } from '../interfaces/retention-strategy.interface';

@Injectable()
export class SnapshotRetentionStrategy implements IRetentionStrategy {
    private readonly logger = new Logger(SnapshotRetentionStrategy.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Logika Category B:
     * Hapus semua data yang tua. Tidak ada ranking.
     * Asumsi: Data "Current" disimpan/diupdate di row yang sama atau memiliki flag is_active (jika ada).
     * Untuk kasus ini, kita asumsikan hard delete berdasarkan tanggal semata.
     */
    async findCandidates(tableName: string, cutoffDate: Date): Promise<string[]> {
        this.logger.log(`Executing Snapshot Retention Analysis on table: ${tableName}`);

        // Whitelist validation
        const allowedTables = ['goal_plans', 'budget_plans', 'insurance_plans'];
        if (!allowedTables.includes(tableName)) {
            throw new Error(`Security Alert: Unauthorized table access '${tableName}'`);
        }

        // Query sederhana: Ambil ID dimana created_at < cutoff
        // Kita gunakan queryRawUnsafe agar dinamis menerima nama tabel
        const query = `
      SELECT id 
      FROM "${tableName}" 
      WHERE created_at < $1::timestamp
    `;

        const result = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
            query,
            cutoffDate
        );

        return result.map((row) => row.id);
    }
}