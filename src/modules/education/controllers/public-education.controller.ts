import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    UseInterceptors,
    ClassSerializerInterceptor,
    Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { EducationReadService } from '../services/education-read.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';

@ApiTags('Education - Learning Portal')
@Controller('education')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor) // Mengaktifkan transformation @Exclude/@Expose
export class PublicEducationController {
    constructor(private readonly readService: EducationReadService) { }

    @Get('categories')
    @ApiOperation({ summary: 'Get list of active learning categories' })
    getCategories() {
        return this.readService.getCategories();
    }

    @Get('modules')
    @ApiOperation({ summary: 'Browse learning modules (Paginated & Filtered)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'category', required: false, type: String })
    findAll(
        @GetUser('id') userId: string,
        @Query('page') page = 1,
        @Query('limit') limit = 10,
        @Query('category') categorySlug?: string,
    ) {
        return this.readService.findAllPublished(userId, {
            page: Number(page),
            limit: Number(limit),
            categorySlug,
        });
    }

    @Get('modules/:slug')
    @ApiOperation({ summary: 'Read full module content by Slug' })
    findOne(@GetUser('id') userId: string, @Param('slug') slug: string) {
        return this.readService.findOneBySlug(userId, slug);
    }
}