import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';

@ApiTags('Director Dashboard')
@UseGuards(AuthGuard('jwt'), RolesGuard) // Double Guard: Login + Cek Role
@ApiBearerAuth()
@Controller('director')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  @Roles(Role.DIRECTOR, Role.ADMIN) // HANYA DIREKSI/ADMIN
  @ApiOperation({ summary: 'Melihat jejak aktivitas user (Audit Trail)' })
  getLogs() {
    return this.auditService.getAllLogs();
  }

  @Get('risky-employees')
  @Roles(Role.DIRECTOR)
  @ApiOperation({ summary: 'List karyawan dengan kesehatan keuangan BAHAYA' })
  getRiskyEmployees() {
    return this.auditService.getRiskyEmployees();
  }
}