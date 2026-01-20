import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EditUserDto } from './dto/edit-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Lihat Profil Sendiri
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitKerja: true }, // Join tabel Unit Kerja
    });
  }

  // Update Profil
  async editUser(userId: string, dto: EditUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...dto,
        // Konversi string date ke Object Date jika ada
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }
}