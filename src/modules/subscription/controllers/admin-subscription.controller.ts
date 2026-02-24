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
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { AdminSubscriptionService } from '../services/admin-subscription.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

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

class BonusQuotaDto {
    @IsNotEmpty()
    @IsNumber()
    @IsPositive({ message: 'Jumlah bonus harus angka positif' })
    amount: number;
}

@Controller('admin/subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Gatekeeper: Seluruh akses di bawah ini hanya untuk ROLE ADMIN
export class AdminSubscriptionController {
    constructor(
        private readonly adminSubscriptionService: AdminSubscriptionService,
    ) { }

    /**
     * Endpoint: GET /admin/subscription/orders
     * Digunakan oleh Admin untuk melihat antrean bukti transfer yang perlu diaudit.
     */
    @Get('orders')
    async getPendingOrders() {
        return this.adminSubscriptionService.getPendingOrders();
    }

    /**
     * Endpoint: PATCH /admin/subscription/verify
     * Eksekusi validasi bukti bayar.
     * Logic: 
     * - Jika VALID, jatah limit user di set ke PRO (9999).
     * - Jika INVALID, status user dicabut (REVOKED) dan limit kembali ke FREE (5).
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
     * Digunakan untuk memberikan status PRO kepada user tanpa perlu proses upload bukti bayar.
     * Cocok untuk pemberian hadiah atau VIP access.
     */
    @Post('override')
    async manualOverride(@Body() dto: ManualOverrideDto) {
        return this.adminSubscriptionService.manualOverride(
            dto.userId,
            dto.planId,
            dto.durationMonths,
        );
    }

    /**
     * Endpoint: PATCH /admin/subscription/bonus-quota/:userId
     * Implementasi 'The Balance Logic'.
     * Memberikan tambahan kuota klien secara manual kepada user tertentu 
     * tanpa harus mengubah status berlangganan mereka.
     */
    @Patch('bonus-quota/:userId')
    async giveBonusQuota(
        @Param('userId') userId: string,
        @Body() dto: BonusQuotaDto,
    ) {
        // Memanggil logic increment di service layer
        return this.adminSubscriptionService.addBonusQuota(userId, dto.amount);
    }
}