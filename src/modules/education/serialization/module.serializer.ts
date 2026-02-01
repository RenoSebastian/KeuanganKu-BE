import { Exclude, Expose, Type } from 'class-transformer';
import { EducationModuleStatus, EducationProgressStatus } from '@prisma/client';

// --- ATOMIC SERIALIZERS ---

export class ModuleSectionSerializer {
    @Expose() id: string;
    @Expose() sectionOrder: number;

    // [FIX] Allow null karena di DB field ini optional (String?)
    @Expose() title: string | null;

    @Expose() contentMarkdown: string;

    // [FIX] Allow null karena di DB field ini optional (String?)
    @Expose() illustrationUrl: string | null;

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

    @Expose() publishedAt: Date | null;

    @Expose()
    @Type(() => CategorySerializer)
    category: CategorySerializer;

    @Expose() userStatus: EducationProgressStatus | 'NOT_STARTED';

    @Exclude() status: EducationModuleStatus;
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

    @Expose() publishedAt: Date | null;

    @Expose()
    @Type(() => CategorySerializer)
    category: CategorySerializer;

    @Expose()
    @Type(() => ModuleSectionSerializer)
    sections: ModuleSectionSerializer[];

    @Expose() currentProgress: {
        status: EducationProgressStatus;
        lastReadSectionId: string | null;
        completedAt: Date | null;
    } | null;

    constructor(partial: Partial<ModuleDetailResponse>) {
        Object.assign(this, partial);
    }
}