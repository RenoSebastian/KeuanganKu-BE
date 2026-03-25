import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RetentionStrategyFactory } from '../strategies/retention-strategy.factory';
import { ExportQueryDto, RetentionEntityType } from '../dto/export-query.dto';
import { Response } from 'express';
import { createHmac } from 'crypto';

@Injectable()
export class ExportManagerService {
    private readonly logger = new Logger(ExportManagerService.name);

    // [SECURE] Harus sama persis dengan yang ada di RetentionService agar validasi token sukses
    private readonly HMAC_SECRET = process.env.RETENTION_SECRET || 'DO_NOT_USE_THIS_IN_PROD_SUPER_SECRET_KEY_99';

    // [ARCHITECTURE] Konstanta Signature untuk validasi file di Client-Side (Fase 3: Smart File Recognition)
    private readonly MGC_SIGNATURE = 'MGC_SECURE_V1';

    constructor(
        private readonly prisma: PrismaService,
        private readonly strategyFactory: RetentionStrategyFactory,
    ) { }

    private getTableName(entityType: string): string {
        const map: Record<string, string> = {
            [RetentionEntityType.FINANCIAL_CHECKUP]: 'financial_checkups',
            [RetentionEntityType.PENSION]: 'pension_plans',
            [RetentionEntityType.GOAL]: 'goal_plans',
            [RetentionEntityType.BUDGET]: 'budget_plans',
            [RetentionEntityType.INSURANCE]: 'insurance_plans',
            'EDUCATION_CLEANUP': 'education_modules',
        };
        return map[entityType];
    }

    async exportDataStream(query: ExportQueryDto, res: Response): Promise<void> {
        const tableName = this.getTableName(query.entityType);

        if (!tableName) {
            throw new BadRequestException(`Table mapping not found for entity ${query.entityType}`);
        }

        this.logger.log(`Stream export initiated for ${query.entityType} (Table: ${tableName})...`);

        // 1. Fetch Data
        const data = await this.prisma.$queryRawUnsafe(
            `SELECT * FROM "${tableName}" WHERE created_at <= $1`,
            new Date(query.cutoffDate),
        );

        if (!Array.isArray(data) || data.length === 0) {
            throw new BadRequestException('No data found to export for the given criteria.');
        }

        // 2. Prepare Response Headers (Fase 1: Backend Optimization)
        // Mengubah ekstensi menjadi .mgc dan memaksakan oktet-stream untuk meminimalisir OS content-sniffing
        const filename = `${query.entityType}_${query.cutoffDate}_${Date.now()}.mgc`;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // [CRITICAL] Mengekspos header agar Frontend Interceptor bisa membaca metadata nama file asli
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        // 3. Generate Security Token
        const pruneToken = this.generatePruneToken(query.entityType, query.cutoffDate);

        // 4. Construct & Stream Payload
        const exportStructure = {
            _mgc_signature: this.MGC_SIGNATURE, // Disuntikkan di baris pertama untuk Pre-flight Stream Validation
            metadata: {
                entity: query.entityType,
                table: tableName,
                cutoffDate: query.cutoffDate,
                recordCount: data.length,
                exportedAt: new Date(),
            },
            security: {
                note: "Use this token to confirm permanent deletion (Prune)",
                pruneToken: pruneToken,
            },
            data: data,
        };

        // Mengonversi payload menjadi Buffer stream biner untuk memastikan transfer data yang presisi
        const bufferPayload = Buffer.from(JSON.stringify(exportStructure, null, 2), 'utf-8');
        res.write(bufferPayload);
        res.end();
    }

    private generatePruneToken(entityType: string, cutoffDate: string): string {
        const payload = JSON.stringify({ entityType, cutoffDate });
        const signature = createHmac('sha256', this.HMAC_SECRET)
            .update(payload)
            .digest('hex');
        return `${Buffer.from(payload).toString('base64')}.${signature}`;
    }
}