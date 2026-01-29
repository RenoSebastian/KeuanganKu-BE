import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EditUserDto } from './dto/edit-user.dto';
import { SearchService } from '../search/search.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService
  ) {}

  // Lihat Profil Sendiri
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitKerja: true },
    });

    if (!user) throw new NotFoundException(`User not found`);

    // Exclude passwordHash
    const { passwordHash, ...result } = user;
    return result;
  }

  // Update Profil
  async editUser(userId: string, dto: EditUserDto) {
    this.logger.log(`Update user ${userId} payload: ${JSON.stringify(Object.keys(dto))}`);

    try {
      // 1. Destructure field yang butuh penanganan khusus
      const { password, dateOfBirth, dependentCount, ...restData } = dto;
      
      // 2. Siapkan payload
      const updatePayload: any = { ...restData };

      // [FIX] Handle Dependent Count (Pastikan Int)
      if (dependentCount !== undefined) {
        updatePayload.dependentCount = Number(dependentCount);
      }

      // [FIX] Handle Date (String YYYY-MM-DD -> Date Object)
      if (dateOfBirth) {
        updatePayload.dateOfBirth = new Date(dateOfBirth);
      }

      // [FIX] Handle Password Hash
      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.passwordHash = await bcrypt.hash(password, salt);
      }

      // 3. Update DB
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
      });

      // 4. Sync Search Engine
      this.syncToSearch(updatedUser);

      // 5. Return clean data
      const { passwordHash, ...result } = updatedUser;
      return result;

    } catch (error) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      throw error;
    }
  }

  private async syncToSearch(user: any) {
    try {
      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'PERSON',
        title: user.fullName,
        subtitle: user.email,
        role: user.role,        
        unitKerjaId: user.unitKerjaId
      };
      await this.searchService.addDocuments('global_search', [searchPayload]);
    } catch (error) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}