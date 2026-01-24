import { Module } from '@nestjs/common';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { PrismaModule } from '../../../prisma/prisma.module'; // Import Prisma agar Service bisa akses DB

@Module({
  imports: [PrismaModule], // Wajib import module dependensi
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}