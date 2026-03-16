import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AdminDashboardService } from '../services/admin-dashboard.service';

// Import DTO
import { DashboardMetricsResponseDto } from '../dto/dashboard-metrics-response.dto';
import { CashflowLedgerResponseDto } from '../dto/cashflow-ledger.dto';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
// SECURITY LEVEL: High. Memastikan bahwa request memiliki token JWT yang valid (Authentication) 
// dan pengguna yang login memiliki role ADMIN (Authorization).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDashboardController {
    constructor(private readonly dashboardService: AdminDashboardService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Mendapatkan statistik dasar admin (Existing)' })
    async getStats() {
        return this.dashboardService.getDashboardStats();
    }

    @Get('online-users')
    @ApiOperation({ summary: 'Mendapatkan daftar pengguna yang sedang online (Existing)' })
    async getOnlineUsers() {
        return this.dashboardService.getOnlineUsersList();
    }

    // =========================================================================
    // FASE 4: FINAL WIRING ENDPOINT ANALITIK & ARUS KAS
    // =========================================================================

    @Get('metrics')
    @ApiOperation({ summary: 'Mendapatkan metrik analitik dashboard (Revenue, Users, System Usage)' })
    @ApiResponse({ status: 200, description: 'Berhasil mengambil metrik', type: DashboardMetricsResponseDto })
    async getMetrics(): Promise<DashboardMetricsResponseDto> {
        // Delegasi penuh ke Orchestrator (AdminDashboardService) yang telah dilindungi Redis Cache
        return this.dashboardService.getDashboardMetrics();
    }

    @Get('cashflow')
    @ApiOperation({ summary: 'Mendapatkan buku besar arus kas (Cashflow Ledger)' })
    @ApiResponse({ status: 200, description: 'Berhasil mengambil riwayat arus kas', type: CashflowLedgerResponseDto })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Halaman data (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Batas data per halaman (default: 10)' })
    async getCashflow(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
    ): Promise<CashflowLedgerResponseDto> {
        // Parse parameter query untuk paginasi dengan fallback aman (mencegah input negatif atau 0)
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const limitNumber = Math.max(1, parseInt(limit, 10) || 10);

        // Delegasi ke AdminDashboardService untuk mengambil riwayat mutasi dari database
        return this.dashboardService.getCashflowLedger(pageNumber, limitNumber);
    }
}