import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EducationModuleStatus } from '@prisma/client';
import {
    ModuleListResponse,
    ModuleDetailResponse,
    CategorySerializer,
    ModuleSectionSerializer,
} from '../serialization/module.serializer';

@Injectable()
export class EducationReadService {
    constructor(private readonly prisma: PrismaService) { }

    // --- 1. GET MODULES LIST (Optimized) ---

    async findAllPublished(userId: string, query: { page: number; limit: number; categorySlug?: string }) {
        const { page = 1, limit = 10, categorySlug } = query;
        const skip = (page - 1) * limit;

        const whereCondition: any = {
            status: EducationModuleStatus.PUBLISHED,
            publishedAt: { lte: new Date() },
        };

        if (categorySlug) {
            whereCondition.category = { slug: categorySlug };
        }

        const modules = await this.prisma.educationModule.findMany({
            where: whereCondition,
            skip,
            take: limit,
            orderBy: { publishedAt: 'desc' },
            include: {
                category: true,
                userProgress: {
                    where: { userId },
                    select: { status: true },
                },
            },
        });

        const total = await this.prisma.educationModule.count({ where: whereCondition });

        const data = modules.map((m) => {
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
        const module = await this.prisma.educationModule.findUnique({
            where: { slug },
            include: {
                category: true,
                sections: {
                    orderBy: { sectionOrder: 'asc' },
                },
                userProgress: {
                    where: { userId },
                },
            },
        });

        if (!module) {
            throw new NotFoundException('Learning module not found.');
        }

        const isPublished =
            module.status === EducationModuleStatus.PUBLISHED &&
            module.publishedAt &&
            module.publishedAt <= new Date();

        if (!isPublished) {
            throw new NotFoundException('Learning module not found or not available yet.');
        }

        const progressRecord = module.userProgress[0];

        return new ModuleDetailResponse({
            ...module,
            category: new CategorySerializer(module.category),
            // [FIX] Explicitly map sections to ensure type compatibility
            sections: module.sections.map((section) => new ModuleSectionSerializer(section)),

            currentProgress: progressRecord
                ? {
                    status: progressRecord.status,
                    lastReadSectionId: progressRecord.lastReadSectionId,
                    completedAt: progressRecord.completedAt,
                }
                : null,
        });
    }

    // --- 3. GET CATEGORIES (Helper) ---

    async getCategories() {
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