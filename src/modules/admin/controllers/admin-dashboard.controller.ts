import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Hanya Admin
export class AdminDashboardController {
    constructor(private readonly dashboardService: AdminDashboardService) { }

    @Get('stats')
    async getStats() {
        return this.dashboardService.getDashboardStats();
    }

    @Get('online-users')
    async getOnlineUsers() {
        return this.dashboardService.getOnlineUsersList();
    }
}