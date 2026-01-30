import { Injectable, BadRequestException } from '@nestjs/common';
import { HistoricalRetentionStrategy } from './historical-retention.strategy';
import { SnapshotRetentionStrategy } from './snapshot-retention.strategy';
import { IRetentionStrategy } from '../interfaces/retention-strategy.interface';

@Injectable()
export class RetentionStrategyFactory {
    constructor(
        private readonly historicalStrategy: HistoricalRetentionStrategy,
        private readonly snapshotStrategy: SnapshotRetentionStrategy,
    ) { }

    getStrategy(entityType: string): { strategy: IRetentionStrategy; tableName: string } {
        switch (entityType) {
            // Kategori A: Historical Critical
            case 'FINANCIAL_CHECKUP':
                return { strategy: this.historicalStrategy, tableName: 'financial_checkups' };
            case 'PENSION':
                return { strategy: this.historicalStrategy, tableName: 'pension_plans' };

            // Kategori B: Snapshot Only
            case 'GOAL':
                return { strategy: this.snapshotStrategy, tableName: 'goal_plans' };
            case 'BUDGET':
                return { strategy: this.snapshotStrategy, tableName: 'budget_plans' };
            case 'INSURANCE':
                return { strategy: this.snapshotStrategy, tableName: 'insurance_plans' };

            default:
                throw new BadRequestException(`Entity type '${entityType}' not supported for retention.`);
        }
    }
}