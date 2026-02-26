import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// Security & Guards
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

// Service & DTOs
import { EducationCategoryService } from '../services/education-category.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

/**
 * Education Category Controller
 * -------------------------------------------------------------------------
 * Bertanggung jawab penuh atas manajemen taksonomi (Kategori) konten edukasi.
 * Dipisahkan dari AdminEducationController untuk isolasi tanggung jawab (High Cohesion).
 * * Flow: Admin Upload Icon ke Media Service -> Dapat URL -> Kirim ke Sini.
 */
@ApiTags('Admin - Education Categories')
@Controller('admin/education/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EducationCategoryController {
    constructor(private readonly categoryService: EducationCategoryService) { }

    // --- CREATE ---

    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({
        summary: 'Create New Education Category',
        description: 'Membuat kategori baru. Field iconUrl harus berupa path relative yang didapat dari endpoint Media Upload.'
    })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Kategori berhasil dibuat.' })
    @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Nama kategori sudah ada (Unique Constraint).' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Format input atau Icon URL tidak valid.' })
    async create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoryService.create(createCategoryDto);
    }

    // --- READ (LIST) ---

    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({
        summary: 'List All Categories',
        description: 'Mengambil daftar semua kategori beserta jumlah modul yang terasosiasi (_count relation).'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Daftar kategori berhasil diambil.' })
    async findAll() {
        return this.categoryService.findAll();
    }

    // --- READ (DETAIL) ---

    @Get(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({
        summary: 'Get Category Details',
        description: 'Melihat detail kategori spesifik berdasarkan UUID.'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Detail kategori ditemukan.' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Kategori tidak ditemukan.' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        // ParseUUIDPipe memastikan ID yang masuk valid format UUID sebelum masuk ke Service
        return this.categoryService.findOne(id);
    }

    // --- UPDATE ---

    @Patch(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({
        summary: 'Update Category',
        description: 'Memperbarui nama, deskripsi, atau icon kategori.'
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Kategori berhasil diperbarui.' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Kategori tidak ditemukan.' })
    @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Nama kategori bentrok dengan yang lain.' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateCategoryDto: UpdateCategoryDto,
    ) {
        return this.categoryService.update(id, updateCategoryDto);
    }

    // --- DELETE (CRITICAL: REFERENTIAL INTEGRITY CHECK) ---

    @Delete(':id')
    @Roles(Role.ADMIN) // Hard Constraint: Hanya Admin yang boleh menghapus Master Data
    @ApiOperation({
        summary: 'Delete Category (Safe Delete)',
        description: `
        Menghapus kategori secara permanen.
        
        **Validation Logic:**
        Sistem akan MENOLAK penghapusan jika kategori ini masih digunakan oleh 'EducationModule'.
        User harus memindahkan atau menghapus modul terkait terlebih dahulu (Manual Cascade Prevention).
        `
    })
    @ApiResponse({ status: HttpStatus.OK, description: 'Kategori berhasil dihapus.' })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Integrity Error: Kategori sedang digunakan oleh modul ajar (P2003 Handled).'
    })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Kategori tidak ditemukan.' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        // Logika handling P2003 (Prisma Foreign Key Constraint) dienkapsulasi di Service
        // untuk menjaga Controller tetap bersih dari logic database low-level.
        return this.categoryService.remove(id);
    }
}