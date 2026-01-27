import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
// [PHASE 5] Import Resource (Pastikan file ini ada atau gunakan logic mapping di bawah)
import { SearchResultResource } from './resources/search-result.resource';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
    private readonly logger = new Logger(SearchController.name);

    constructor(private readonly searchService: SearchService) { }

    @Get() // Endpoint: /search?q=... (Global Search)
    async omniSearch(
        @Query() query: SearchQueryDto,
        @GetUser() user: any,
    ) {
        // Redirect ke specific handler agar lebih modular
        return this.searchEmployees(query, user);
    }

    @Get('employees') // Endpoint: /search/employees?q=... (Specific)
    async searchEmployees(
        @Query() searchQueryDto: SearchQueryDto,
        @GetUser() user: any,
    ) {
        const startTime = Date.now();

        // 1. Dapatkan Raw Data dari Service (Hybrid: Meili + PG Trigram)
        // Note: Parameter 'user' kita simpan dulu (opsional) untuk logic personalization kedepannya
        const rawResults = await this.searchService.searchEmployees(searchQueryDto);

        // 2. [PHASE 5] Transformasi Data ke Format Standar (DTO Response)
        // Menggunakan Resource Pattern agar output JSON konsisten (mirip Laravel API Resource)
        const standardizedData = rawResults.map(result => new SearchResultResource(result));

        // Hitung execution time untuk monitoring performa
        const executionTime = `${Date.now() - startTime}ms`;

        // 3. Return Response dengan Metadata Lengkap
        return {
            success: true,
            data: standardizedData,
            meta: {
                total: standardizedData.length,
                limit: Number(searchQueryDto.limit) || 10,
                query: searchQueryDto.q,
                timestamp: new Date().toISOString(),
                performance: executionTime, // Penting untuk debug speed hybrid engine
                engine: standardizedData.length > 0 ? standardizedData[0].source : 'none' // Info source (Meili/DB)
            }
        };
    }
}