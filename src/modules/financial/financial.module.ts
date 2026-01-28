import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // Pastikan import Prisma jika Service butuh
import { PdfGeneratorService } from './services/pdf-generator.service';

@Module({
  imports: [PrismaModule], // Tambahkan jika FinancialService menggunakan Prisma
  controllers: [FinancialController],
  providers: [FinancialService, PdfGeneratorService],
  exports: [FinancialService] // <--- WAJIB DITAMBAHKAN
})
export class FinancialModule { }