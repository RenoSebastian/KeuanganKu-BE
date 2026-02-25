import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // Pastikan import Prisma jika Service butuh
import { PdfGeneratorService } from './services/pdf-generator.service';
import { NotificationModule } from '../notification/notification.module'; // [NEW] Import ini
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationModule], // Tambahkan jika FinancialService menggunakan Prisma
  controllers: [FinancialController],
  providers: [FinancialService, PdfGeneratorService],
  exports: [FinancialService] // <--- WAJIB DITAMBAHKAN
})
export class FinancialModule { }