import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { BudgetService } from './services/budget.service'; // [NEW] Stateless Calculator
import { MarketModule } from '../market/market.module'; // [NEW] Untuk Telemetri

@Module({
  imports: [
    PrismaModule,
    MarketModule // Module untuk menyimpan statistik pasar (MarketInsight)
  ],
  controllers: [FinancialController],
  providers: [
    FinancialService,    // Legacy/Orchestrator Service
    BudgetService,       // Service baru untuk perhitungan Budgeting
    PdfGeneratorService
  ],
  exports: [
    FinancialService,
    BudgetService        // Export agar bisa di-inject di tempat lain jika perlu
  ]
})
export class FinancialModule { }