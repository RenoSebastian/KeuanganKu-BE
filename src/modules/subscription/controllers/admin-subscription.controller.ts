import {
    Body,
    Controller,
    Get,
    Patch,
    Post,
    Param,
    UseGuards,
    Query, // [NEW] Import Query
} from '@nestjs/common';
import { Role, VerificationStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiProperty, ApiQuery } from '@nestjs/swagger'; // [NEW] Import ApiQuery
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
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminSubscriptionController {
    constructor(
        private readonly adminSubscriptionService: AdminSubscriptionService,
    ) { }

    /**
     * [PERBAIKAN ARSITEKTUR - TASK 3]
     * Implementasi Pagination & Reusability.
     * Endpoint ini sekarang melayani Dashboard Widget (limit kecil) dan Halaman Verifikasi Utama (limit besar).
     */
    @Get('pending')
    @ApiOperation({ summary: 'Mendapatkan daftar antrean verifikasi (Mendukung Pagination)' })
    @ApiQuery({ name: 'page', required: false, type: Number, description: 'Halaman data (default: 1)' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Batas data per halaman (default: 10, Dashboard Widget bisa menggunakan 5)' })
    async getPendingOrders(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
    ) {
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const limitNumber = Math.max(1, parseInt(limit, 10) || 10);

        return this.adminSubscriptionService.getPendingOrders(pageNumber, limitNumber);
    }

    @Patch('verify')
    @ApiOperation({ summary: 'Approve or Reject subscription order' })
    async verifyOrder(
        @GetUser('id') adminId: string,
        @Body() dto: VerifyOrderDto,
    ) {
        return this.adminSubscriptionService.verifyOrder(adminId, dto);
    }

    @Post('bulk-verify')
    @ApiOperation({ summary: 'Bulk Approve or Reject multiple orders simultaneously' })
    async bulkVerifyOrders(
        @GetUser('id') adminId: string,
        @Body() dto: BulkVerifyDto,
    ) {
        return this.adminSubscriptionService.bulkVerifyOrders(adminId, dto);
    }

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