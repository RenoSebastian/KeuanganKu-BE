import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EditUserDto } from './dto/edit-user.dto';

@Injectable()
export class UsersService {
  // 1. Inisialisasi Logger dengan Context khusus 'UsersService'
  // Ini membuat output log nanti tertulis: [UsersService] ...
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  // Lihat Profil Sendiri
  async getMe(userId: string) {
    // [LOG INFO] Mencatat aktivitas standar
    this.logger.log(`Fetching profile data for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitKerja: true },
    });

    // [LOG WARN] Mencatat anomali (data harusnya ada, tapi tidak ditemukan)
    if (!user) {
      this.logger.warn(`User profile not found for ID: ${userId}`);
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  // Update Profil
  async editUser(userId: string, dto: EditUserDto) {
    // [LOG INFO] Mencatat payload request (Hati-hati jangan log password!)
    this.logger.log(`Attempting update for user ${userId} with data: ${JSON.stringify(dto)}`);

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...dto,
          // Konversi string date ke Object Date jika ada
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        },
      });

      // [LOG INFO] Konfirmasi sukses
      this.logger.log(`User ${userId} successfully updated.`);
      return updatedUser;

    } catch (error) {
      // [LOG ERROR] Mencatat kegagalan operasi kritis
      // Parameter ke-2 'error.stack' memastikan stack trace tersimpan di file log error
      this.logger.error(`Failed to update user ${userId}`, error.stack);
      
      // Lempar error agar ditangkap oleh Global Exception Filter yang kita buat di Phase 3
      // dan dikembalikan sebagai response JSON yang rapi ke user.
      throw error;
    }
  }
}