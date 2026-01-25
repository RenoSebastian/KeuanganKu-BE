import { Module } from '@nestjs/common';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { FinancialModule } from '../financial/financial.module'; // [FIX] Import Wajib
import { AuditModule } from '../audit/audit.module';             // [FIX] Import Wajib

@Module({
  imports: [
    PrismaModule,
    FinancialModule, // Wajib: agar DirectorService bisa inject FinancialService
    AuditModule      // Wajib: agar DirectorService bisa inject AuditService
  ],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}