import {
    Body,
    Controller,
    Get,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    HttpStatus,
    HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiTags
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import * as client from '@prisma/client';
import { SubscriptionService } from '../services/subscription.service';
import { CreateSubscriptionOrderDto } from '../dto/create-subscription-order.dto';

@ApiTags('Subscription (User)')
@Controller('subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    /**
     * Endpoint: GET /subscription/plans
     * Mengambil daftar paket yang tersedia (Master Data)
     */
    @Get('plans')
    @ApiOperation({ summary: 'Get available subscription plans' })
    async getPlans() {
        return this.subscriptionService.getPlans();
    }

    /**
     * Endpoint: GET /subscription/current
     * Mengecek status subscription user yang sedang login
     */
    @Get('current')
    @ApiOperation({ summary: 'Get current active subscription status' })
    async getMySubscription(@GetUser() user: client.User) {
        return this.subscriptionService.getMySubscription(user.id);
    }

    /**
     * Endpoint: GET /subscription/orders
     * Mengambil riwayat transaksi user
     */
    @Get('orders')
    @ApiOperation({ summary: 'Get my subscription order history' })
    async getMyOrders(@GetUser() user: client.User) {
        return this.subscriptionService.getMyOrders(user.id);
    }

    /**
     * Endpoint: POST /subscription/buy
     * User membeli paket -> Upload Bukti -> Langsung Aktif (Optimistic)
     */
    @Post('buy')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Purchase plan & Upload proof (Optimistic Activation)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['planId', 'proofFile'],
            properties: {
                planId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'ID dari Subscription Plan yang dipilih'
                },
                proofFile: {
                    type: 'string',
                    format: 'binary',
                    description: 'File bukti transfer (JPG/PNG/PDF, Max 2MB)',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('proofFile'))
    async buySubscription(
        @GetUser() user: client.User,
        @Body() dto: CreateSubscriptionOrderDto,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // Max 2MB
                    new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp|pdf)$/ }), // Allow Images & PDF
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        // Logic: Panggil service untuk proses transaksi & aktivasi instan
        return this.subscriptionService.subscribe(user.id, dto, file);
    }
}