// File: src/modules/admin/controllers/admin-dashboard.controller.ts

import { Controller, Get, UseGuards, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import express from 'express'; // Injeksi spesifik untuk kontrol aliran data buffer

// Import Services
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { AdminPdfGeneratorService } from '../services/admin-pdf-generator.service';

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
    constructor(
        private readonly dashboardService: AdminDashboardService,
        private readonly analyticsService: AdminAnalyticsService,
        private readonly pdfGeneratorService: AdminPdfGeneratorService
    ) { }

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
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const limitNumber = Math.max(1, parseInt(limit, 10) || 10);

        return this.dashboardService.getCashflowLedger(pageNumber, limitNumber);
    }

    // =========================================================================
    // FASE 3: EXPORT DOKUMEN FISIK
    // =========================================================================

    @Get('cashflow/export')
    @ApiOperation({ summary: 'Mengekspor data buku besar arus kas ke dalam format PDF' })
    @ApiQuery({ name: 'period', required: false, type: String, description: 'Teks periode opsional (misal: "Januari 2026")' })
    async exportCashflowPdf(
        @Res() res: express.Response,
        @Query('period') period: string = 'Keseluruhan'
    ) {
        // 1. Ekstraksi Data (Information Expert)
        // Karena ini ekspor dokumen utuh, kita melakukan hard limit (misal: 1000 transaksi terbaru)
        // Anda bisa mengadaptasinya dengan melempar parameter rentang tanggal jika diperlukan
        const rawLedgerData = await this.dashboardService.getCashflowLedger(1, 1000);

        // 2. Transformasi ke PDF (Fabricator Pattern)
        const pdfBuffer = await this.pdfGeneratorService.generateCashflowReport(rawLedgerData.data, period);

        // 3. Konfigurasi Transmisi Header
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Laporan_Arus_Kas_${new Date().getTime()}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        // 4. Lepaskan stream ke Front-End
        res.end(pdfBuffer);
    }

    // =========================================================================
    // FASE 2: LAYER AGREGASI TIME-SERIES UNTUK INVESTOR
    // =========================================================================

    @Get('analytics/growth')
    @ApiOperation({ summary: 'Mendapatkan data time-series pertumbuhan akuisisi pengguna' })
    @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Format ISO 8601 (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Format ISO 8601 (YYYY-MM-DD)' })
    @ApiQuery({ name: 'resolution', required: true, enum: ['daily', 'weekly', 'monthly'] })
    async getUserGrowth(
        @Query('startDate') startDateStr: string,
        @Query('endDate') endDateStr: string,
        @Query('resolution') resolution: 'daily' | 'weekly' | 'monthly'
    ) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        return this.analyticsService.getUserGrowthAnalytics(startDate, endDate, resolution);
    }

    @Get('analytics/engagement')
    @ApiOperation({ summary: 'Mendapatkan data time-series tingkat keterlibatan (login) pengguna' })
    @ApiQuery({ name: 'startDate', required: true, type: String, description: 'Format ISO 8601 (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', required: true, type: String, description: 'Format ISO 8601 (YYYY-MM-DD)' })
    @ApiQuery({ name: 'resolution', required: true, enum: ['daily', 'weekly', 'monthly'] })
    async getUserEngagement(
        @Query('startDate') startDateStr: string,
        @Query('endDate') endDateStr: string,
        @Query('resolution') resolution: 'daily' | 'weekly' | 'monthly'
    ) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);

        return this.analyticsService.getUserEngagementAnalytics(startDate, endDate, resolution);
    }
}