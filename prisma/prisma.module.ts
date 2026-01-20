import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // PENTING: Agar tidak perlu import berkali-kali di module lain
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}