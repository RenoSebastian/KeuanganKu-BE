import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { AdminSubscriptionService } from '../services/admin-subscription.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';

// DTO Sederhana untuk Override Manual (Internal use for this controller)
class ManualOverrideDto {
    userId: string;
    planId: string;
    durationMonths?: number;
}

@Controller('admin/subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Gatekeeper: Hanya Admin yang bisa akses semua endpoint di bawah ini
export class AdminSubscriptionController {
    constructor(
        private readonly adminSubscriptionService: AdminSubscriptionService,
    ) { }

    /**
     * Endpoint: GET /admin/subscription/orders
     * Melihat daftar order yang statusnya PENDING (menunggu verifikasi)
     */
    @Get('orders')
    async getPendingOrders() {
        return this.adminSubscriptionService.getPendingOrders();
    }

    /**
     * Endpoint: PATCH /admin/subscription/verify
     * Eksekusi validasi (VALID/INVALID). 
     * Jika INVALID, status user yang sudah aktif akan di-REVOKE otomatis oleh Service.
     */
    @Patch('verify')
    async verifyOrder(
        @GetUser('id') adminId: string,
        @Body() dto: VerifyOrderDto,
    ) {
        return this.adminSubscriptionService.verifyOrder(adminId, dto);
    }

    /**
     * Endpoint: POST /admin/subscription/override
     * Fitur Super User: Tembak status aktif manual tanpa bukti bayar.
     */
    @Post('override')
    async manualOverride(@Body() dto: ManualOverrideDto) {
        return this.adminSubscriptionService.manualOverride(
            dto.userId,
            dto.planId,
            dto.durationMonths,
        );
    }
}