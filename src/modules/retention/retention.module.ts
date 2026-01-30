import { Module } from '@nestjs/common';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';
import { PrismaModule } from '../../../prisma/prisma.module';

// Strategy & Factory
import { HistoricalRetentionStrategy } from './strategies/historical-retention.strategy';
import { SnapshotRetentionStrategy } from './strategies/snapshot-retention.strategy';
import { RetentionStrategyFactory } from './strategies/retention-strategy.factory';
import { ExportManagerService } from './services/export-manager.service';

@Module({
    imports: [PrismaModule],
    controllers: [RetentionController],
    providers: [
        RetentionService,
        RetentionStrategyFactory,
        HistoricalRetentionStrategy,
        SnapshotRetentionStrategy,
        ExportManagerService
    ],
    exports: [RetentionService],
})
export class RetentionModule { }