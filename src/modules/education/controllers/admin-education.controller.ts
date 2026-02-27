import {
    Body,
    Controller,
    Delete,
    Param,
    Patch,
    Post,
    Put,
    UseGuards,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    ClassSerializerInterceptor,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { EducationManagementService } from '../services/education-management.service';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { UpdateModuleStatusDto } from '../dto/update-module-status.dto';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';
import { UpsertQuizDto } from '../dto/upsert-quiz.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { Role } from '@prisma/client';
import { Get } from '@nestjs/common';

@ApiTags('Admin - Education Management')
@Controller('admin/education')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Security Gate: Hanya Admin & Director
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor) // Transformasi Output (Exclude sensitive fields)
export class AdminEducationController {
    constructor(private readonly managementService: EducationManagementService) { }

    @Post('modules')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create new learning module (Draft)' })
    @ApiResponse({ status: 201, description: 'Module created successfully.' })
    create(
        @GetUser('id') userId: string,
        @Body() dto: CreateModuleDto
    ) {
        // [LOGIC CHANGE] Mengirim userId ke service untuk audit trail
        // Payload 'dto' berisi path gambar (string), bukan file binary.
        return this.managementService.createModule(userId, dto);
    }

    @Patch('modules/:id')
    @ApiOperation({ summary: 'Update module metadata (Title, Thumbnail, etc) & Cleanup old files' })
    @ApiResponse({ status: 200, description: 'Module updated.' })
    update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
        // [LOGIC CHANGE] Service akan otomatis menghapus file lama jika thumbnail berubah
        return this.managementService.updateModule(id, dto);
    }

    @Patch('modules/:id/status')
    @ApiOperation({ summary: 'Publish, Archive, or Draft a module' })
    updateStatus(@Param('id') id: string, @Body() dto: UpdateModuleStatusDto) {
        return this.managementService.updateStatus(id, dto);
    }

    @Post('modules/:id/reorder-sections')
    @ApiOperation({ summary: 'Reorder sections within a module' })
    @HttpCode(HttpStatus.OK)
    reorderSections(@Param('id') id: string, @Body() dto: ReorderSectionsDto) {
        return this.managementService.reorderSections(id, dto);
    }

    @Delete('modules/:id')
    @ApiOperation({ summary: 'Permanently delete a module and its physical files' })
    @ApiResponse({ status: 200, description: 'Module and associated files deleted.' })
    delete(@Param('id') id: string) {
        // [LOGIC CHANGE] Service akan melakukan cascade delete DB + delete file fisik
        return this.managementService.deleteModule(id);
    }

    // --- QUIZ MANAGEMENT ---

    @Put('modules/:id/quiz')
    @ApiOperation({
        summary: 'Upsert (Create/Replace) Quiz for a module',
        description: 'Transactional save. Replaces all existing questions with the new payload.'
    })
    upsertQuiz(@Param('id') id: string, @Body() dto: UpsertQuizDto) {
        return this.managementService.upsertQuiz(id, dto);
    }

    @Get('modules')
    @ApiOperation({ summary: 'Get all modules list (Admin View)' })
    @ApiResponse({ status: 200, description: 'Return all modules' })
    findAll() {
        return this.managementService.findAllModules();
    }
}