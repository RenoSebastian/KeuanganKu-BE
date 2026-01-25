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
  DashboardSummaryDto,
} from './dto/director-dashboard.dto'; 
import { EmployeeAuditDetailDto } from './dto/employee-detail-response.dto'; 

@ApiTags('Director Dashboard') 
@ApiBearerAuth()              
@UseGuards(JwtAuthGuard, RolesGuard) // LAYER 1: Cek Token Valid & Cek Role Guard Active
@Roles(client.Role.DIRECTOR)          // LAYER 2: Spesifik hanya Role DIRECTOR
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
    // Memanggil method getRiskMonitor (sesuai update di service step sebelumnya)
    return this.directorService.getRiskMonitor();
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
  @Get('employees/:id/checkup') 
  @ApiOperation({ summary: 'Mendapatkan detail audit lengkap satu karyawan (Memicu Audit Log)' })
  @ApiResponse({ status: 200, type: EmployeeAuditDetailDto })
  async getEmployeeAuditDetail(
    @GetUser() director: client.User, // Mengambil data Direksi yang sedang login (Actor)
    @Param('id') targetUserId: string // ID Karyawan yang ingin dilihat (Target)
  ) {
    // Service akan mencatat Audit Trail: Actor -> Melihat -> Target
    return this.directorService.getEmployeeAuditDetail(director.id, targetUserId);
  }
}