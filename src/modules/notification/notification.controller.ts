import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @Get()
    @ApiOperation({ summary: 'Get my notifications history (Paginated)' })
    async getMyNotifications(
        @GetUser('id') userId: string,
        @Query('page', new ParseIntPipe({ optional: true })) page = 1,
        @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    ) {
        return this.notificationService.getUserNotifications(userId, page, limit);
    }

    @Patch('read-all')
    @ApiOperation({ summary: 'Mark ALL my notifications as read' })
    @HttpCode(HttpStatus.OK)
    async markAllRead(@GetUser('id') userId: string) {
        await this.notificationService.markAllAsRead(userId);
        return { message: 'All notifications marked as read' };
    }

    @Patch(':id/read')
    @ApiOperation({ summary: 'Mark specific notification as read' })
    @HttpCode(HttpStatus.OK)
    async markRead(
        @GetUser('id') userId: string,
        @Param('id') notificationId: string,
    ) {
        await this.notificationService.markAsRead(notificationId, userId);
        return { message: 'Notification marked as read' };
    }
}