import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { MarketSettingsController } from '../admin/controllers/market-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MasterDataController, MarketSettingsController],
  providers: [MasterDataService],
})
export class MasterDataModule { }