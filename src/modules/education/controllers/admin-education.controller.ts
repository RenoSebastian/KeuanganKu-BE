import {
    Body,
    Controller,
    Delete,
    Param,
    Patch,
    Post,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EducationManagementService } from '../services/education-management.service';
import { CreateModuleDto } from '../dto/create-module.dto';
import { UpdateModuleDto } from '../dto/update-module.dto';
import { UpdateModuleStatusDto } from '../dto/update-module-status.dto';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client'; // Import Enum Role dari Prisma

@ApiTags('Admin - Education Management')
@Controller('admin/education')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.DIRECTOR) // Gatekeeper Utama
@ApiBearerAuth()
export class AdminEducationController {
    constructor(private readonly managementService: EducationManagementService) { }

    @Post('modules')
    @ApiOperation({ summary: 'Create new learning module (Draft)' })
    create(@Body() dto: CreateModuleDto) {
        return this.managementService.create(dto);
    }

    @Patch('modules/:id')
    @ApiOperation({ summary: 'Update module metadata (Title, Thumbnail, etc)' })
    update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
        return this.managementService.update(id, dto);
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
    @ApiOperation({ summary: 'Permanently delete a module and its sections' })
    delete(@Param('id') id: string) {
        return this.managementService.delete(id);
    }
}