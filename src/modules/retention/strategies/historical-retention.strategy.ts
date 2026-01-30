import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IRetentionStrategy } from '../interfaces/retention-strategy.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class HistoricalRetentionStrategy implements IRetentionStrategy {
    private readonly logger = new Logger(HistoricalRetentionStrategy.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Logika Category A:
     * 1. Partition data by user_id
     * 2. Order by created_at DESC (Terbaru = Rank 1)
     * 3. FILTER: Hapus jika (Rank > 1) DAN (created_at < cutoffDate)
     * * Hasil: User selalu memiliki minimal 1 data history (data terakhir), 
     * sisanya yang usang akan dihapus.
     */
    async findCandidates(tableName: string, cutoffDate: Date): Promise<string[]> {
        this.logger.log(`Executing Historical Retention Analysis on table: ${tableName}`);

        // SECURITY: Whitelist table name untuk mencegah SQL Injection
        // Karena identifier tabel tidak bisa diparameterisasi di PostgreSQL standard
        this.validateTableName(tableName);

        try {
            // Menggunakan CTE (Common Table Expression) dan Window Function
            // Syntax 'Prisma.sql' digunakan untuk escaping parameter tanggal
            const query = `
        WITH RankedData AS (
          SELECT 
            id, 
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY user_id 
              ORDER BY created_at DESC
            ) as rn
          FROM "${tableName}"
        )
        SELECT id 
        FROM RankedData 
        WHERE rn > 1 
          AND created_at < $1::timestamp;
      `;

            // Eksekusi Raw Query
            const result = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
                query,
                cutoffDate
            );

            this.logger.log(`Found ${result.length} historical candidates to archive.`);
            return result.map((row) => row.id);

        } catch (error) {
            this.logger.error(`Error in Historical Retention Strategy: ${error.message}`, error.stack);
            throw error;
        }
    }

    private validateTableName(tableName: string): void {
        const allowedTables = ['financial_checkups', 'education_plans', 'pension_plans'];
        if (!allowedTables.includes(tableName)) {
            throw new Error(`Security Alert: Unauthorized table access '${tableName}' in Retention Strategy.`);
        }
    }
}