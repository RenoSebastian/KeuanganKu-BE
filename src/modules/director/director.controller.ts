import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import * as client from '@prisma/client'; 

import { DirectorService } from './director.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard'; 
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator'; // Decorator untuk ambil data user dari Token

// Import DTO
import {
  DashboardStatsDto,
  RiskyEmployeeDto,
  UnitRankingDto,
  DashboardSummaryDto, // <--- IMPORT DTO SUMMARY (PHASE 5)
} from './dto/director-dashboard.dto'; 
import { EmployeeAuditDetailDto } from './dto/employee-detail-response.dto'; 

@ApiTags('Director Dashboard') 
@ApiBearerAuth()              
@UseGuards(JwtAuthGuard, RolesGuard) // GUARD AKTIF: Cek Login & Cek Role
@Roles(client.Role.DIRECTOR)          // SECURITY HARD LOCK: Hanya Role DIRECTOR yang boleh masuk
@Controller('director')
export class DirectorController {
  constructor(private readonly directorService: DirectorService) {}

  // ===========================================================================
  // 0. DASHBOARD ORCHESTRATOR (PHASE 5 - SINGLE ENTRY POINT)
  // ===========================================================================
  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Mendapatkan seluruh data dashboard (Stats, Risk, Ranking) dalam satu request' })
  @ApiResponse({ status: 200, type: DashboardSummaryDto })
  getDashboardSummary() {
    return this.directorService.getDashboardSummary();
  }

  // ===========================================================================
  // 1. DASHBOARD RESUME (Grafik & Statistik Utama)
  // ===========================================================================
  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Mendapatkan ringkasan eksekutif (Statistik & Aset)' })
  @ApiResponse({ status: 200, type: DashboardStatsDto })
  getDashboardStats() {
    return this.directorService.getDashboardStats();
  }

  // ===========================================================================
  // 2. RISK MONITOR (Daftar Karyawan Berisiko)
  // ===========================================================================
  @Get('risk-monitor')
  @ApiOperation({ summary: 'Mendapatkan daftar karyawan dengan status BAHAYA/WASPADA' })
  @ApiResponse({ status: 200, type: [RiskyEmployeeDto] })
  getRiskMonitor() {
    return this.directorService.getRiskyEmployees();
  }

  // ===========================================================================
  // 3. UNIT RANKING (Peringkat Kesehatan Divisi)
  // ===========================================================================
  @Get('unit-rankings')
  @ApiOperation({ summary: 'Mendapatkan peringkat kesehatan finansial per Unit Kerja' })
  @ApiResponse({ status: 200, type: [UnitRankingDto] })
  getUnitRankings() {
    return this.directorService.getUnitRankings();
  }

  // ===========================================================================
  // 4. GLOBAL SEARCH (Pencarian Karyawan Spesifik)
  // ===========================================================================
  @Get('search')
  @ApiOperation({ summary: 'Cari karyawan berdasarkan Nama, Email, atau Unit' })
  @ApiQuery({ name: 'q', required: true, description: 'Kata kunci pencarian' })
  searchEmployees(@Query('q') keyword: string) {
    return this.directorService.searchEmployees(keyword);
  }

  // ===========================================================================
  // 5. EMPLOYEE DETAIL (Deep Dive + Audit)
  // ===========================================================================
  @Get('employees/:id/checkup') // Route sesuai Logic Workflow
  @ApiOperation({ summary: 'Mendapatkan detail audit lengkap satu karyawan (Trigger Audit Log)' })
  @ApiResponse({ status: 200, type: EmployeeAuditDetailDto })
  async getEmployeeAuditDetail(
    @GetUser() director: client.User, // Ambil User object milik Direksi (Actor)
    @Param('id') targetUserId: string // Ambil ID Karyawan (Target)
  ) {
    // Panggil Service dengan 2 parameter untuk memicu Audit Trail
    return this.directorService.getEmployeeDetail(director.id, targetUserId);
  }
}