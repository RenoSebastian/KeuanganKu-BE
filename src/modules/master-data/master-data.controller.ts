import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { MasterDataService } from './master-data.service';

@ApiTags('Master Data')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('master-data')
export class MasterDataController {
    constructor(private readonly service: MasterDataService) { }

    // --- UNIT KERJA ---

    @Get('units')
    // Bisa diakses semua user terautentikasi untuk dropdown
    findAllUnits() {
        return this.service.findAllUnits();
    }

    @Post('units')
    @Roles(Role.ADMIN)
    createUnit(@Body() dto: CreateUnitDto) {
        return this.service.createUnit(dto);
    }

    @Patch('units/:id')
    @Roles(Role.ADMIN)
    updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
        return this.service.updateUnit(id, dto);
    }

    @Delete('units/:id')
    @Roles(Role.ADMIN)
    deleteUnit(@Param('id') id: string) {
        return this.service.deleteUnit(id);
    }
}