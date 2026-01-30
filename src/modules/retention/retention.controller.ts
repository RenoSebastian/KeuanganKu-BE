import {
    Controller,
    Get,
    Delete,
    UseGuards,
    HttpStatus,
    Query,
    Res,
    Body
} from '@nestjs/common';
import express from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// Services (Separation of Concerns)
import { RetentionService } from './retention.service';
import { ExportManagerService } from './services/export-manager.service';

// DTOs
import { DatabaseStatsResponseDto } from './dto/database-stats.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { PruneExecutionDto } from './dto/prune-execution.dto';

// Security & Decorators
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Admin - Data Retention & Archiving')
@Controller('admin/retention')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RetentionController {
    constructor(
        private readonly retentionService: RetentionService,
        private readonly exportManagerService: ExportManagerService,
    ) { }

    // --- ENDPOINT 1: MONITORING (Fase 1) ---

    @Get('stats')
    @Roles(Role.ADMIN) // Hard Constraint: Hanya Admin yang boleh akses
    @ApiOperation({
        summary: 'Get Database Storage Statistics',
        description: 'Mengembalikan statistik ukuran tabel dan estimasi jumlah baris menggunakan metadata PostgreSQL (O(1)).'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Statistik berhasil diambil.',
        type: DatabaseStatsResponseDto
    })
    async getStats(): Promise<DatabaseStatsResponseDto> {
        return this.retentionService.getDatabaseStats();
    }

    // --- ENDPOINT 2: SAFE EXPORT (Fase 3) ---

    @Get('export')
    @Roles(Role.ADMIN)
    @ApiOperation({
        summary: 'Safe Export Archive Data (Streaming)',
        description: `
      Meng-export data kandidat penghapusan ke format JSON secara streaming (Memory Safe).
      
      Mekanisme:
      1. Validasi Input (EntityType & Cutoff Date).
      2. Identifikasi ID kandidat menggunakan 'Smart Deletion Logic'.
      3. Streaming data per batch (1000 baris) langsung ke HTTP Response.
      
      Note: Endpoint ini WAJIB dipanggil dan file tersimpan sebelum melakukan pruning manual.
    `,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Stream file JSON dimulai. Browser akan otomatis memunculkan dialog download.',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Tidak ada data kandidat yang memenuhi kriteria retensi (Database bersih).',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Parameter EntityType tidak valid atau Format Tanggal salah.',
    })
    @ApiProduces('application/json')
    async exportData(
        @Query() query: ExportQueryDto,
        @Res() res: express.Response,
    ): Promise<void> {
        // ARCHITECTURAL NOTE:
        // Kita menggunakan @Res() untuk mengambil alih kontrol Response Stream dari NestJS.
        // Tujuannya agar Service bisa menulis chunk data (res.write) secara bertahap
        // tanpa menunggu seluruh data termuat di RAM server.

        await this.exportManagerService.exportDataStream(query, res);
    }

    // --- ENDPOINT 3: EXECUTION (Fase 4 - New Implementation) ---

    @Delete('prune')
    @Roles(Role.ADMIN) // SUPER CRITICAL: Hanya Admin
    @ApiOperation({
        summary: 'Execute Data Pruning (Permanent Deletion)',
        description: `
      Menghapus data arsip secara permanen berdasarkan kebijakan retensi.
      
      Requires:
      1. confirmExported = true
      2. cutoffDate < Awal Bulan Ini (Data bulan berjalan tidak boleh dihapus)
      
      Action ini bersifat TRANSAKSIONAL dan akan dicatat di tabel retention_logs.
    `
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Pruning berhasil dieksekusi. Mengembalikan jumlah data yang terhapus.'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Safety Violation (Mencoba menghapus bulan berjalan atau belum konfirmasi export).'
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: 'Terjadi kesalahan saat batch deletion (Safety Rollback triggered).'
    })
    async pruneData(
        @Body() dto: PruneExecutionDto,
        @GetUser('id') adminId: string, // Mengambil ID Admin dari JWT Token untuk Audit Log
    ) {
        return this.retentionService.executePruning(adminId, dto);
    }
}