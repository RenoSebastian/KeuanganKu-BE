import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';

// Controllers
import { AdminEducationController } from './controllers/admin-education.controller';
import { PublicEducationController } from './controllers/public-education.controller';
import { EducationCategoryController } from './controllers/education-category.controller'; // [FIX] Import Controller Kategori

// Services
import { EducationManagementService } from './services/education-management.service';
import { EducationReadService } from './services/education-read.service';
import { QuizEngineService } from './services/quiz-engine.service';
import { EducationCategoryService } from './services/education-category.service'; // [FIX] Import Service Kategori

import { MediaModule } from '../media/media.module';

@Module({
    imports: [PrismaModule, MediaModule],
    controllers: [
        AdminEducationController,
        PublicEducationController,
        EducationCategoryController, // [FIX] Daftarkan Controller ke router tree
    ],
    providers: [
        EducationManagementService,
        EducationReadService,
        QuizEngineService,
        EducationCategoryService, // [FIX] Daftarkan Service ke DI Container
    ],
    exports: [
        EducationManagementService,
        EducationReadService,
        QuizEngineService,
        EducationCategoryService, // Opsional: Export jika modul lain membutuhkan servis kategori
    ],
})
export class EducationModule { }