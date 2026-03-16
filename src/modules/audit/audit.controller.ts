import {
  Controller,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Admin System Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Security Gate: Hanya Admin yang dapat memantau log sistem
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  /**
   * [PHASE 3 ENHANCEMENT]
   * Endpoint: GET /admin/audit/logs
   * Mengambil log aktivitas administratif menggunakan Cursor Pagination (High Performance).
   */
  @Get('logs')
  @ApiOperation({ summary: 'Get System Activity Logs (Cursor Paginated)' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Limit item per fetch (Default: 50)' })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'ID log terakhir dari batch sebelumnya' })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter berdasarkan Action Type tertentu' })
  async getSystemLogs(
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('cursor') cursor?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.getAdminSystemLogs({ cursor, take, action });
  }

  // Mengakomodasi log akses pengguna umum jika diperlukan Admin Dashboard
  @Get('access-logs')
  @ApiOperation({ summary: 'Melihat riwayat aktivitas user aplikasi (Offset/Limit)' })
  async getAccessLogs(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number
  ) {
    return this.auditService.getAllLogs(limit);
  }
}