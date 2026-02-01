import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';

// Controllers
import { AdminEducationController } from './controllers/admin-education.controller';
import { PublicEducationController } from './controllers/public-education.controller'; // [NEW]

// Services
import { EducationManagementService } from './services/education-management.service';
import { EducationReadService } from './services/education-read.service'; // [NEW]

@Module({
    imports: [PrismaModule],
    controllers: [
        AdminEducationController, // Phase 2
        PublicEducationController, // Phase 3
    ],
    providers: [
        EducationManagementService, // Phase 2
        EducationReadService, // Phase 3
    ],
    exports: [
        EducationManagementService,
        EducationReadService, // Export read service untuk dipakai fitur rekomendasi nanti
    ],
})
export class EducationModule { }