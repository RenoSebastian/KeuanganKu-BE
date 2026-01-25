import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // Pastikan import Prisma jika Service butuh

@Module({
  imports: [PrismaModule], // Tambahkan jika FinancialService menggunakan Prisma
  controllers: [FinancialController],
  providers: [FinancialService],
  exports: [FinancialService] // <--- WAJIB DITAMBAHKAN
})
export class FinancialModule {}