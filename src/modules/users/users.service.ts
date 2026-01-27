import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EditUserDto } from './dto/edit-user.dto';
import { SearchService } from '../search/search.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService // [PHASE 3] Inject Search Service
  ) {}

  // Lihat Profil Sendiri
  async getMe(userId: string) {
    this.logger.log(`Fetching profile data for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitKerja: true },
    });

    if (!user) {
      this.logger.warn(`User profile not found for ID: ${userId}`);
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Optional: Kita bisa trigger sync saat get untuk memastikan data consistency (Self-healing)
    // this.syncToSearch(user); 
    
    return user;
  }

  // Update Profil
  async editUser(userId: string, dto: EditUserDto) {
    this.logger.log(`Attempting update for user ${userId}`);

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...dto,
          // Konversi string date ke Object Date jika ada (Logic pelengkap)
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        },
      });

      this.logger.log(`User ${userId} successfully updated.`);

      // [PHASE 3] TRIGGER SYNC (Fire-and-Forget)
      // Kita tidak menggunakan 'await' agar user tidak perlu menunggu proses indexing selesai.
      this.syncToSearch(updatedUser);

      return updatedUser;

    } catch (error) {
      this.logger.error(`Failed to update user ${userId}`, error.stack);
      throw error;
    }
  }

  /**
   * [PHASE 3] INTERNAL HELPER: Sync to Meilisearch
   * Mengubah data User DB menjadi format standar 'Hybrid Search'
   */
  private async syncToSearch(user: any) {
    try {
      // Mapping Data agar sesuai dengan Schema Hybrid Search (Phase 2)
      // Structure: id, redirectId, type, title, subtitle
      const searchPayload = {
        id: user.id,            // Primary Key Meili
        redirectId: user.id,    // ID referensi ke DB
        type: 'PERSON',         // Discriminator Type
        title: user.fullName,   // Main Search Keyword (Nama)
        subtitle: user.email,   // Secondary Search Keyword (Email)
        // Metadata tambahan untuk filtering (jika perlu)
        role: user.role,        
        unitKerjaId: user.unitKerjaId
      };

      // Push ke index 'global_search'
      await this.searchService.addDocuments('global_search', [searchPayload]);
      
      this.logger.debug(`🔄 Synced user ${user.id} to Meilisearch index.`);
    } catch (error) {
      // Error handling silent agar transaksi DB utama tidak terganggu
      // Log level 'error' agar terdeteksi di monitoring
      this.logger.error(`⚠️ Failed to sync user ${user.id} to Meilisearch: ${error.message}`);
    }
  }
}