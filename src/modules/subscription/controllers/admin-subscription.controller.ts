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
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import { AdminSubscriptionService } from '../services/admin-subscription.service';
import { VerifyOrderDto } from '../dto/verify-order.dto';

// --- DTO Internal untuk Keamanan Validasi ---

export class ManualOverrideDto {
    @ApiProperty({ description: 'ID User yang akan diberikan akses' })
    @IsNotEmpty()
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'ID Plan (Paket) yang diberikan' })
    @IsNotEmpty()
    @IsUUID()
    planId: string;

    @ApiProperty({ description: 'Durasi akses dalam bulan (Opsional, default ikut plan)', required: false })
    @IsOptional()
    @IsNumber()
    @IsPositive()
    durationMonths?: number;

    @ApiProperty({ description: 'Alasan pemberian akses (untuk Audit Log)', example: 'Bonus Marketing Campaign' })
    @IsOptional()
    @IsString()
    reason?: string;
}

export class InjectQuotaDto {
    @ApiProperty({ description: 'Jumlah token (Positif untuk tambah, Negatif untuk kurang)' })
    @IsNotEmpty()
    @IsNumber()
    amount: number;

    @ApiProperty({ description: 'Alasan penambahan/pengurangan (Wajib untuk Audit)', example: 'Kompensasi error sistem' })
    @IsNotEmpty()
    @IsString()
    reason: string;
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
    @Get('pending')
    @ApiOperation({ summary: 'Get pending subscription orders' })
    async getPendingOrders() {
        return this.adminSubscriptionService.getPendingOrders();
    }

    /**
     * Endpoint: PATCH /admin/subscription/verify
     * Eksekusi validasi bukti bayar.
     * Mencatat Audit Log siapa admin yang memverifikasi.
     */
    @Patch('verify')
    @ApiOperation({ summary: 'Approve or Reject subscription order' })
    async verifyOrder(
        @GetUser('id') adminId: string, // [NEW] Track Admin ID
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
    async manualOverride(
        @GetUser('id') adminId: string,
        @Body() dto: ManualOverrideDto,
    ) {
        return this.adminSubscriptionService.manualOverride(
            adminId,
            dto.userId,
            dto.planId,
            dto.durationMonths,
            dto.reason,
        );
    }

    /**
     * [PHASE 5 UPDATE]
     * Endpoint: PATCH /admin/subscription/users/:userId/quota
     * Implementasi 'The Safety Net'.
     * Memberikan tambahan Token Kuota secara manual kepada user tertentu.
     * Menggunakan Ledger System di backend.
     */
    @Patch('users/:userId/quota') // URL diperbaiki agar RESTful
    @ApiOperation({
        summary: 'Inject/Top-up Simulation Quota manually',
        description: 'Menambah token kuota user. Wajib menyertakan alasan untuk audit.',
    })
    @ApiBody({ type: InjectQuotaDto })
    async injectQuota(
        @GetUser('id') adminId: string,
        @Param('userId') userId: string,
        @Body() dto: InjectQuotaDto,
    ) {
        return this.adminSubscriptionService.injectQuota(
            adminId,
            userId,
            dto.amount,
            dto.reason,
        );
    }
}