import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MarketService } from './market.service';

@Module({
  imports: [HttpModule],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}