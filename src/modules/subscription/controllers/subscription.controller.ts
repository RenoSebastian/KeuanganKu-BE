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
    HttpStatus,
    HttpCode,
    FileValidator,
    Logger,
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
// [FIX] Gunakan 'import type' karena User dari prisma adalah Interface/Type, bukan Class value
import type { User } from '@prisma/client';
import { SubscriptionService } from '../services/subscription.service';
import { CreateSubscriptionOrderDto } from '../dto/create-subscription-order.dto';

// --- CUSTOM VALIDATOR CLASS ---
class SubscriptionFileValidator extends FileValidator<{}> {
    private readonly logger = new Logger('FileValidator');

    isValid(file?: Express.Multer.File): boolean {
        if (!file) return false;

        // Debugging log
        this.logger.log(`Processing upload: ${file.originalname} | Mime: ${file.mimetype}`);

        // Whitelist Mime Types
        const allowedMimes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
            'application/octet-stream'
        ];

        // Validasi logic
        const isValidMime = allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/');

        return isValidMime;
    }

    buildErrorMessage(file: any): string {
        return `Format file tidak didukung (${file?.mimetype}). Harap upload Gambar (JPG/PNG) atau PDF.`;
    }
}

@ApiTags('Subscription (User)')
@Controller('subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    @Get('plans')
    @ApiOperation({ summary: 'Get available subscription plans' })
    async getPlans() {
        return this.subscriptionService.getPlans();
    }

    @Get('current')
    @ApiOperation({ summary: 'Get current active subscription status' })
    async getMySubscription(@GetUser() user: User) {
        return this.subscriptionService.getMySubscription(user.id);
    }

    @Get('my-orders')
    @ApiOperation({ summary: 'Get my subscription order history' })
    async getMyOrders(@GetUser() user: User) {
        return this.subscriptionService.getMyOrders(user.id);
    }

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
        @GetUser() user: User,
        @Body() dto: CreateSubscriptionOrderDto,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    // 1. Validasi Ukuran (Max 2MB)
                    new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),

                    // 2. Validasi Tipe (Custom Class Validator)
                    new SubscriptionFileValidator({}),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        return this.subscriptionService.subscribe(user.id, dto, file);
    }
}