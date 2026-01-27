import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SearchResultResource } from './resources/search-result.resource';

@Controller('search')
@UseGuards(JwtAuthGuard) // Wajib Login
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('employees')
  async searchEmployees(
    @Query() searchQueryDto: SearchQueryDto,
    @GetUser() user: any,
  ) {
    // Controller bertindak sebagai Proxy yang cerdas
    // Dia meneruskan data user yang sedang login untuk keperluan filtering
    const results = await this.searchService.searchEmployees(searchQueryDto, user);

    const transformedHits = SearchResultResource.collect(results.hits);
    
    return {
      success: true,
      data: transformedHits,
      meta: {
        total: results.estimatedTotalHits,
        time: results.processingTimeMs,
        query: searchQueryDto.q
      }
    };
  }
}