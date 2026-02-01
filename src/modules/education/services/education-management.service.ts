import {
    BadRequestException,
    Injectable,
    NotFoundException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { UpdateModuleStatusDto } from '../dto/update-module-status.dto';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';
import { EducationModuleStatus } from '@prisma/client';
import slugify from 'slugify';

@Injectable()
export class EducationManagementService {
    private readonly logger = new Logger(EducationManagementService.name);

    constructor(private readonly prisma: PrismaService) { }

    // --- CORE CRUD ---

    async create(dto: CreateModuleDto) {
        const { sections, ...moduleData } = dto;

        // 1. Validasi Kategori
        const categoryExists = await this.prisma.educationCategory.findUnique({
            where: { id: moduleData.categoryId },
        });
        if (!categoryExists) {
            throw new BadRequestException('Category ID invalid or not found.');
        }

        // 2. Generate Unique Slug
        const slug = await this.generateUniqueSlug(moduleData.title);

        // 3. Atomic Transaction (Header + Sections)
        try {
            const result = await this.prisma.$transaction(async (tx) => {
                // A. Create Header
                const newModule = await tx.educationModule.create({
                    data: {
                        ...moduleData,
                        slug,
                        status: EducationModuleStatus.DRAFT, // Default selalu DRAFT
                        publishedAt: null,
                    },
                });

                // B. Create Sections
                if (sections && sections.length > 0) {
                    const sectionPayload = sections.map((s) => ({
                        moduleId: newModule.id,
                        sectionOrder: s.sectionOrder,
                        title: s.title,
                        contentMarkdown: s.contentMarkdown,
                        illustrationUrl: s.illustrationUrl,
                    }));
                    await tx.moduleSection.createMany({ data: sectionPayload });
                }

                return newModule;
            });

            return result;
        } catch (error) {
            this.logger.error(`Failed to create education module: ${error.message}`);
            throw new InternalServerErrorException('Transaction failed while creating module.');
        }
    }

    async update(id: string, dto: UpdateModuleDto) {
        // 1. Cek Eksistensi
        const existing = await this.prisma.educationModule.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Module not found');

        // 2. Handle Slug Update jika Title berubah
        // [FIX] Explicit Type Declaration to avoid "Type 'string' is not assignable to type 'undefined'" error
        let newSlug: string | undefined;

        if (dto.title && dto.title !== existing.title) {
            newSlug = await this.generateUniqueSlug(dto.title);
        }

        // 3. Update DB
        return this.prisma.educationModule.update({
            where: { id },
            data: {
                ...dto,
                slug: newSlug, // Now safe to pass undefined or string
            },
        });
    }

    async updateStatus(id: string, dto: UpdateModuleStatusDto) {
        const module = await this.prisma.educationModule.findUnique({
            where: { id },
            include: { sections: true },
        });

        if (!module) throw new NotFoundException('Module not found');

        // --- LOGIC GUARDRAIL: No Empty Publish ---
        if (dto.status === EducationModuleStatus.PUBLISHED) {
            if (!module.sections || module.sections.length === 0) {
                throw new BadRequestException(
                    'Cannot PUBLISH a module with no sections (Empty Content). Please add content first.',
                );
            }
        }

        return this.prisma.educationModule.update({
            where: { id },
            data: {
                status: dto.status,
                publishedAt: dto.status === EducationModuleStatus.PUBLISHED ? new Date() : module.publishedAt,
            },
        });
    }

    async delete(id: string) {
        const module = await this.prisma.educationModule.findUnique({ where: { id } });
        if (!module) throw new NotFoundException('Module not found');

        // Hard Delete: Karena Cascade delete aktif di Schema, sections otomatis terhapus.
        return this.prisma.educationModule.delete({
            where: { id },
        });
    }

    // --- SECTION MANAGEMENT ---

    async reorderSections(moduleId: string, dto: ReorderSectionsDto) {
        const module = await this.prisma.educationModule.findUnique({ where: { id: moduleId } });
        if (!module) throw new NotFoundException('Module not found');

        return this.prisma.$transaction(
            dto.items.map((item) =>
                this.prisma.moduleSection.update({
                    where: { id: item.sectionId, moduleId },
                    data: { sectionOrder: item.newOrder },
                }),
            ),
        );
    }

    // --- UTILITIES ---

    private async generateUniqueSlug(title: string): Promise<string> {
        const baseSlug = slugify(title, { lower: true, strict: true });
        let slug = baseSlug;
        let counter = 1;
        let isUnique = false;

        while (!isUnique) {
            const existing = await this.prisma.educationModule.findUnique({
                where: { slug },
            });

            if (!existing) {
                isUnique = true;
            } else {
                counter++;
                slug = `${baseSlug}-${counter}`;
            }
        }

        return slug;
    }
}