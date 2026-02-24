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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { GetUser } from '../../../common/decorators/get-user.decorator';
import * as client from '@prisma/client';
import { SubscriptionService } from '../services/subscription.service';
import { CreateSubscriptionOrderDto } from '../dto/create-subscription-order.dto';

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    /**
     * Endpoint: GET /subscription/plans
     * Mengambil daftar paket yang tersedia (Master Data)
     */
    @Get('plans')
    async getPlans() {
        return this.subscriptionService.getPlans();
    }

    /**
     * Endpoint: GET /subscription/current
     * Mengecek status subscription user yang sedang login
     */
    @Get('current')
    async getMySubscription(@GetUser() user: client.User) {
        return this.subscriptionService.getMySubscription(user.id);
    }

    /**
     * Endpoint: POST /subscription/buy
     * User membeli paket -> Upload Bukti -> Langsung Aktif (Optimistic)
     */
    @Post('buy')
    @UseInterceptors(FileInterceptor('proofFile'))
    async buySubscription(
        @GetUser() user: client.User,
        @Body() dto: CreateSubscriptionOrderDto,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // Max 2MB
                    new FileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ }), // Gambar atau PDF
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        // Logic: Panggil service untuk proses transaksi & aktivasi instan
        return this.subscriptionService.subscribe(user.id, dto, file);
    }
}