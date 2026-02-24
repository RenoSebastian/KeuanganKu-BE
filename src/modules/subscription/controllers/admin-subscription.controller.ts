import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Param,
    UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { AdminSubscriptionService } from '../services/admin-subscription.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';

// --- DTO Internal untuk Keamanan Validasi ---

class ManualOverrideDto {
    @IsNotEmpty()
    @IsUUID()
    userId: string;

    @IsNotEmpty()
    @IsUUID()
    planId: string;

    @IsOptional()
    @IsNumber()
    @IsPositive()
    durationMonths?: number;
}

class TopUpQuotaDto {
    @IsNotEmpty()
    @IsNumber()
    // Note: Tidak pakai @IsPositive agar Admin bisa input negatif (koreksi pengurangan) jika perlu
    amount: number;
}

@ApiTags('Admin Subscription & Quota')
@Controller('admin/subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Gatekeeper: Seluruh akses di bawah ini hanya untuk ROLE ADMIN
@ApiBearerAuth()
export class AdminSubscriptionController {
    constructor(
        private readonly adminSubscriptionService: AdminSubscriptionService,
    ) { }

    /**
     * Endpoint: GET /admin/subscription/orders
     * Digunakan oleh Admin untuk melihat antrean bukti transfer yang perlu diaudit.
     */
    @Get('orders')
    @ApiOperation({ summary: 'Get pending subscription orders' })
    async getPendingOrders() {
        return this.adminSubscriptionService.getPendingOrders();
    }

    /**
     * Endpoint: PATCH /admin/subscription/verify
     * Eksekusi validasi bukti bayar.
     * Logic: 
     * - Jika VALID, jatah limit user di set ke PRO (9999).
     * - Jika INVALID, status user dicabut (REVOKED) dan limit kembali ke FREE (3).
     */
    @Patch('verify')
    @ApiOperation({ summary: 'Approve or Reject subscription order' })
    async verifyOrder(
        @GetUser('id') adminId: string,
        @Body() dto: VerifyOrderDto,
    ) {
        return this.adminSubscriptionService.verifyOrder(adminId, dto);
    }

    /**
     * Endpoint: POST /admin/subscription/override
     * Digunakan untuk memberikan status PRO kepada user tanpa perlu proses upload bukti bayar.
     * Cocok untuk pemberian hadiah atau VIP access.
     */
    @Post('override')
    @ApiOperation({ summary: 'Manual override to give PRO access (Super Admin)' })
    async manualOverride(@Body() dto: ManualOverrideDto) {
        return this.adminSubscriptionService.manualOverride(
            dto.userId,
            dto.planId,
            dto.durationMonths,
        );
    }

    /**
     * [PHASE 5 UPDATE]
     * Endpoint: PATCH /admin/subscription/topup-quota/:userId
     * Implementasi 'The Safety Net'.
     * Memberikan tambahan Token Kuota secara manual kepada user tertentu 
     * untuk menangani komplain atau bonus.
     */
    @Patch('topup-quota/:userId')
    @ApiOperation({
        summary: 'Inject/Top-up Simulation Quota manually',
        description: 'Menambah token kuota user. Masukkan nilai negatif untuk mengurangi.'
    })
    @ApiBody({ type: TopUpQuotaDto })
    async topUpQuota(
        @Param('userId') userId: string,
        @Body() dto: TopUpQuotaDto,
    ) {
        // Memanggil logic update kuota di service layer
        return this.adminSubscriptionService.topUpQuota(userId, dto.amount);
    }
}