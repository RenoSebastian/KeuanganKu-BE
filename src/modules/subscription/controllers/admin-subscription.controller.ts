import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Param,
    UseGuards,
} from '@nestjs/common';
import { Role, VerificationStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, IsArray, IsEnum } from 'class-validator';

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

// [PHASE 1: ENHANCEMENT] DTO untuk operasi pemrosesan massal
export class BulkVerifyDto {
    @ApiProperty({ description: 'Array of Order IDs yang akan dieksekusi' })
    @IsArray()
    @IsUUID('all', { each: true })
    orderIds: string[];

    @ApiProperty({ description: 'Target Status Eksekusi (VALID / INVALID)' })
    @IsNotEmpty()
    @IsEnum(VerificationStatus)
    status: VerificationStatus;

    @ApiProperty({ description: 'Catatan admin untuk semua transaksi yang dipilih', required: false })
    @IsOptional()
    @IsString()
    adminNotes?: string;
}

// [PHASE 1: ENHANCEMENT] DTO untuk operasi Reversal (Cabut akses)
export class RevokeOrderDto {
    @ApiProperty({ description: 'ID Order yang sudah berstatus VALID' })
    @IsNotEmpty()
    @IsUUID()
    orderId: string;

    @ApiProperty({ description: 'Alasan pencabutan (Wajib)', example: 'Bukti transfer terindikasi palsu setelah audit bank' })
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

    @Get('pending')
    @ApiOperation({ summary: 'Get pending subscription orders' })
    async getPendingOrders() {
        return this.adminSubscriptionService.getPendingOrders();
    }

    @Patch('verify')
    @ApiOperation({ summary: 'Approve or Reject subscription order' })
    async verifyOrder(
        @GetUser('id') adminId: string,
        @Body() dto: VerifyOrderDto,
    ) {
        return this.adminSubscriptionService.verifyOrder(adminId, dto);
    }

    /**
     * [PHASE 1: ENHANCEMENT]
     * Endpoint: POST /admin/subscription/bulk-verify
     * Memproses puluhan/ratusan bukti transfer secara bersamaan.
     */
    @Post('bulk-verify')
    @ApiOperation({ summary: 'Bulk Approve or Reject multiple orders simultaneously' })
    async bulkVerifyOrders(
        @GetUser('id') adminId: string,
        @Body() dto: BulkVerifyDto,
    ) {
        return this.adminSubscriptionService.bulkVerifyOrders(adminId, dto);
    }

    /**
     * [PHASE 1: ENHANCEMENT]
     * Endpoint: POST /admin/subscription/revoke
     * Compensating Transaction: Membatalkan order yang terlanjur disetujui, 
     * mencabut akses PRO, dan menarik mundur kuota (reversal).
     */
    @Post('revoke')
    @ApiOperation({ summary: 'Revoke an already approved order (Compensating Transaction)' })
    async revokeOrder(
        @GetUser('id') adminId: string,
        @Body() dto: RevokeOrderDto,
    ) {
        return this.adminSubscriptionService.revokeOrder(adminId, dto);
    }

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

    @Patch('users/:userId/quota')
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