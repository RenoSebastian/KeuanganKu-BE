import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('search')
@UseGuards(JwtAuthGuard) // Wajib Login
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('employees') // Endpoint ini sekarang melayani Omni Search (Global)
  async searchEmployees(
    @Query() searchQueryDto: SearchQueryDto,
    @GetUser() user: any,
  ) {
    // 1. Panggil Service
    // Service sekarang sudah mengembalikan array format standar: 
    // [{ title, subtitle, type, redirectId, ... }]
    const results = await this.searchService.searchEmployees(searchQueryDto, user);

    // 2. Return Response
    // Kita tidak perlu lagi mengakses .hits atau .estimatedTotalHits karena 
    // return dari service bisa jadi berasal dari Database (yang tidak punya properti itu).
    
    return {
      success: true,
      data: results, // Langsung pasang array hasil
      meta: {
        total: results.length, // Hitung manual jumlah data yang didapat
        query: searchQueryDto.q,
        // timestamp: new Date() // Opsional
      }
    };
  }
}