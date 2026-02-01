import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EducationModuleStatus } from '@prisma/client';
import {
    ModuleListResponse,
    ModuleDetailResponse,
    CategorySerializer,
} from '../serialization/module.serializer';

@Injectable()
export class EducationReadService {
    constructor(private readonly prisma: PrismaService) { }

    // --- 1. GET MODULES LIST (Optimized) ---

    async findAllPublished(userId: string, query: { page: number; limit: number; categorySlug?: string }) {
        const { page = 1, limit = 10, categorySlug } = query;
        const skip = (page - 1) * limit;

        // Filter Dasar: Hanya Published & Tanggal Rilis <= Sekarang
        const whereCondition: any = {
            status: EducationModuleStatus.PUBLISHED,
            publishedAt: { lte: new Date() }, // Mencegah konten masa depan bocor
        };

        if (categorySlug) {
            whereCondition.category = { slug: categorySlug };
        }

        // A. Ambil Data Modul (Tanpa Body Konten)
        const modules = await this.prisma.educationModule.findMany({
            where: whereCondition,
            skip,
            take: limit,
            orderBy: { publishedAt: 'desc' }, // Konten terbaru di atas
            include: {
                category: true, // Eager load kategori
                // Optimized: Kita fetch progress user sekalian lewat relation
                // Note: Di Prisma, filtering relation agak tricky, jadi kita mapping manual
                userProgress: {
                    where: { userId },
                    select: { status: true },
                },
            },
        });

        const total = await this.prisma.educationModule.count({ where: whereCondition });

        // B. Transformasi ke Serializer
        const data = modules.map((m) => {
            // Ambil progress user pertama (jika ada)
            const progress = m.userProgress[0];

            return new ModuleListResponse({
                ...m,
                userStatus: progress ? progress.status : 'NOT_STARTED',
                category: new CategorySerializer(m.category),
            });
        });

        return {
            data,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
            },
        };
    }

    // --- 2. GET MODULE DETAIL (With Content & Injection) ---

    async findOneBySlug(userId: string, slug: string) {
        // A. Fetch Module + Sections + Progress
        const module = await this.prisma.educationModule.findUnique({
            where: { slug },
            include: {
                category: true,
                sections: {
                    orderBy: { sectionOrder: 'asc' }, // Pastikan urutan baca benar
                },
                userProgress: {
                    where: { userId }, // Inject progress user spesifik ini
                },
            },
        });

        // B. Guard: Not Found atau Belum Rilis
        if (!module) {
            throw new NotFoundException('Learning module not found.');
        }

        // Security Check: Jika user mencoba tembak slug DRAFT via URL
        const isPublished =
            module.status === EducationModuleStatus.PUBLISHED &&
            module.publishedAt &&
            module.publishedAt <= new Date();

        if (!isPublished) {
            // Kita return 404 agar user tidak tahu eksistensi draft tersebut
            throw new NotFoundException('Learning module not found or not available yet.');
        }

        // C. Prepare Progress Data
        const progressRecord = module.userProgress[0]; // Array pasti max 1 atau 0 karena Composite PK

        // D. Return Serialized Data
        return new ModuleDetailResponse({
            ...module,
            category: new CategorySerializer(module.category),
            // Mapping progress object agar bersih
            currentProgress: progressRecord
                ? {
                    status: progressRecord.status,
                    lastReadSectionId: progressRecord.lastReadSectionId,
                    completedAt: progressRecord.completedAt,
                }
                : null, // User belum pernah buka
        });
    }

    // --- 3. GET CATEGORIES (Helper) ---

    async getCategories() {
        // Hanya ambil kategori yang memiliki setidaknya 1 modul aktif
        // Ini teknik "Smart Filtering" agar menu tidak kosong
        const categories = await this.prisma.educationCategory.findMany({
            where: {
                isActive: true,
                modules: {
                    some: {
                        status: EducationModuleStatus.PUBLISHED,
                        publishedAt: { lte: new Date() },
                    },
                },
            },
            orderBy: { displayOrder: 'asc' },
        });

        return categories.map((c) => new CategorySerializer(c));
    }
}