import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
// [PHASE 5] Import Resource
import { SearchResultResource } from './resources/search-result.resource';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('employees')
  async searchEmployees(
    @Query() searchQueryDto: SearchQueryDto,
    @GetUser() user: any,
  ) {
    // 1. Dapatkan Raw Data dari Service (Hybrid Result)
    const rawResults = await this.searchService.searchEmployees(searchQueryDto, user);

    // 2. [PHASE 5] Transformasi Data ke Format Standar
    // Frontend akan menerima struktur JSON yang konsisten
    const standardizedData = SearchResultResource.collect(rawResults);

    // 3. Return Response dengan Metadata Pagination/Query
    return {
      success: true,
      data: standardizedData, 
      meta: {
        total: standardizedData.length,
        limit: Number(searchQueryDto.limit) || 10,
        query: searchQueryDto.q,
        timestamp: new Date().toISOString()
      }
    };
  }
}