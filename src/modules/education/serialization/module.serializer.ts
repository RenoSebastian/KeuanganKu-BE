import { Exclude, Expose, Type } from 'class-transformer';
import { EducationModuleStatus, EducationProgressStatus } from '@prisma/client';

// --- ATOMIC SERIALIZERS ---

export class ModuleSectionSerializer {
    @Expose() id: string;
    @Expose() sectionOrder: number;
    @Expose() title: string;
    @Expose() contentMarkdown: string; // Hanya dikirim saat Detail View
    @Expose() illustrationUrl: string;

    constructor(partial: Partial<ModuleSectionSerializer>) {
        Object.assign(this, partial);
    }
}

export class CategorySerializer {
    @Expose() id: string;
    @Expose() name: string;
    @Expose() slug: string;
    @Expose() iconUrl: string;

    constructor(partial: Partial<CategorySerializer>) {
        Object.assign(this, partial);
    }
}

// --- COMPOSITE SERIALIZERS ---

export class ModuleListResponse {
    @Expose() id: string;
    @Expose() title: string;
    @Expose() slug: string;
    @Expose() thumbnailUrl: string;
    @Expose() excerpt: string;
    @Expose() readingTime: number;
    @Expose() publishedAt: Date;

    @Expose()
    @Type(() => CategorySerializer)
    category: CategorySerializer;

    // Progress Ringan untuk List View (Optional, misal: "Sudah dibaca?")
    @Expose() userStatus: EducationProgressStatus | 'NOT_STARTED';

    @Exclude() status: EducationModuleStatus; // Hide internal status
    @Exclude() createdAt: Date;
    @Exclude() updatedAt: Date;

    constructor(partial: Partial<ModuleListResponse>) {
        Object.assign(this, partial);
    }
}

export class ModuleDetailResponse {
    @Expose() id: string;
    @Expose() title: string;
    @Expose() slug: string;
    @Expose() thumbnailUrl: string;
    @Expose() readingTime: number;
    @Expose() publishedAt: Date;

    @Expose()
    @Type(() => CategorySerializer)
    category: CategorySerializer;

    @Expose()
    @Type(() => ModuleSectionSerializer)
    sections: ModuleSectionSerializer[];

    // --- PROGRESS INJECTION ---
    // Data ini disuntikkan runtime berdasarkan siapa user yang login
    @Expose() currentProgress: {
        status: EducationProgressStatus;
        lastReadSectionId: string | null;
        completedAt: Date | null;
    } | null;

    constructor(partial: Partial<ModuleDetailResponse>) {
        Object.assign(this, partial);
    }
}