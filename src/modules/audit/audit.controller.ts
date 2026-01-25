import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard'; // Pastikan path import sesuai struktur folder
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Audit System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTOR) // Security: Hanya Direksi yang boleh akses log sistem
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Melihat riwayat aktivitas sistem (Audit Trail)' })
  async getAuditLogs() {
    return this.auditService.getAllLogs();
  }

  // [CLEANUP] Method getRiskyEmployees dihapus dari sini.
  // Fitur tersebut sekarang berada di DirectorController (Director Module).
}