import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EditUserDto } from './dto/edit-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto'; // [NEW IMPORT]

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) { }

  // =================================================================
  // AUTH & SELF-SERVICE
  // =================================================================

  /**
   * createUser (Frictionless Registration)
   * Membuat user baru dengan data minimal (Nama, Email, Password).
   */
  async createUser(dto: CreateUserDto) {
    const { password, ...rest } = dto;

    // 1. Hash Password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    try {
      // 2. Create User
      const newUser = await this.prisma.user.create({
        data: {
          nama: dto.nama,
          email: dto.email,
          password: hashedPassword, // Maps to 'password_hash' in DB via Schema
          role: 'USER', // Default Role
          // Field profil lain (company, noWa, dll) otomatis NULL
        },
      });

      // 3. Sync to Search (Async - Fire & Forget)
      this.syncToSearch(newUser);

      // 4. Return result without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = newUser;
      return result;
    } catch (error) {
      // Handle Unique Constraint (Email duplicate)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email sudah terdaftar.');
      }

      this.logger.error(`Create user failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Gagal mendaftarkan pengguna.');
    }
  }

  /**
   * getMe
   * Mengambil profil diri sendiri.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException(`User not found`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
  }

  /**
   * updateProfile (Phase 3: Gradual Completion)
   * Digunakan oleh Agen untuk melengkapi data diri mereka sendiri.
   * Method ini aman (IDOR safe karena userId dari Token) dan menangani transformasi data.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Prisma.UserUpdateInput = { ...dto };

    // 1. Transformasi Tanggal (String ISO -> Date Object)
    // Penting: Frontend sering mengirim tanggal sebagai string JSON
    if (dto.tanggalLahir) {
      updateData.tanggalLahir = new Date(dto.tanggalLahir);
    }

    try {
      // 2. Eksekusi Update
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });

      // 3. Sync ke Search Engine
      // Agar data profil baru (Company, Jabatan) langsung bisa dicari
      await this.syncToSearch(updatedUser);

      // 4. Return Clean Data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = updatedUser;
      return result;

    } catch (error) {
      this.logger.error(`Failed to update profile for user ${userId}: ${error.message}`);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new NotFoundException('User tidak ditemukan.');
      }

      throw new InternalServerErrorException('Gagal mengupdate profil.');
    }
  }

  /**
   * editUser (Legacy / Backward Compatibility)
   * Jika masih ada controller lama yang menggunakan EditUserDto.
   */
  async editUser(userId: string, dto: EditUserDto) {
    this.logger.log(
      `User ${userId} editing self (Legacy). Fields: ${Object.keys(dto).join(', ')}`,
    );
    return this.processUpdate(userId, dto);
  }

  /**
   * findByEmail
   * Digunakan oleh AuthService untuk Login.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * findOne
   * Digunakan oleh JWT Strategy.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = user;
    return result;
  }

  // =================================================================
  // ADMIN FEATURES (Manajemen Agen)
  // =================================================================

  /**
   * findAll
   * List user dengan fitur pencarian nama/email/perusahaan.
   */
  async findAll(params: { search?: string; role?: Role }) {
    const { search, role } = params;
    const where: Prisma.UserWhereInput = {};

    // Filter by Role
    if (role) {
      where.role = role;
    }

    // Filter by Search (Nama / Email / Company)
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        company: true,
        jabatan: true,
        noWa: true,
        createdAt: true,
      },
    });
  }

  /**
   * updateUser (Admin)
   */
  async updateUser(id: string, dto: UpdateUserDto) {
    return this.processUpdate(id, dto);
  }

  /**
   * deleteUser (Admin)
   */
  async deleteUser(id: string) {
    // Pastikan user ada
    await this.getMe(id);

    const deleted = await this.prisma.user.delete({ where: { id } });

    // Cleanup Search Index
    this.searchService
      .removeDocument('global_search', id)
      .catch((e) =>
        this.logger.warn(`Search cleanup failed for ${id}: ${e.message}`),
      );

    return { message: 'User deleted successfully', id: deleted.id };
  }

  // =================================================================
  // HELPERS
  // =================================================================

  /**
   * processUpdate
   * Logika terpusat untuk update profil yang komprehensif (termasuk password).
   * Digunakan oleh Admin atau Legacy Edit.
   */
  private async processUpdate(userId: string, dto: any) {
    try {
      const { password, tanggalLahir, ...restData } = dto;

      // 1. Bersihkan undefined/empty values
      const updatePayload: any = {};
      Object.keys(restData).forEach((key) => {
        if (restData[key] !== undefined && restData[key] !== '') {
          updatePayload[key] = restData[key];
        }
      });

      // 2. Handle Tanggal Lahir (String to Date)
      if (tanggalLahir) {
        updatePayload.tanggalLahir = new Date(tanggalLahir);
      }

      // 3. Handle Password Rotation
      if (password) {
        const salt = await bcrypt.genSalt();
        updatePayload.password = await bcrypt.hash(password, salt);
      }

      // 4. Execute Update
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload,
      });

      // 5. Sync to Search Engine
      this.syncToSearch(updatedUser);

      // 6. Return sanitized result
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = updatedUser;
      return result;
    } catch (error) {
      this.logger.error(`Failed update user ${userId}: ${error.message}`);
      if (error.code === 'P2025') throw new NotFoundException('User not found');
      throw error;
    }
  }

  /**
   * syncToSearch
   * Sinkronisasi data agen ke MeiliSearch (Fire & Forget).
   */
  private async syncToSearch(user: any) {
    try {
      const searchPayload = {
        id: user.id,
        redirectId: user.id,
        type: 'AGENT',
        title: user.nama,
        subtitle: user.email,
        description: `${user.company || 'Tanpa Perusahaan'} - ${user.jabatan || 'Agen'}`,
        role: user.role,
      };

      this.searchService
        .addDocuments('global_search', [searchPayload])
        .catch((e) => this.logger.warn(`Search sync error: ${e.message}`));
    } catch (error) {
      this.logger.error(`Sync search failed: ${error.message}`);
    }
  }
}