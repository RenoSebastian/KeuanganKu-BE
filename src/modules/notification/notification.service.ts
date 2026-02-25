import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationType, NotificationCategory } from '@prisma/client';

export interface CreateNotificationDto {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;       // INFO, SUCCESS, WARNING, ERROR
    category: NotificationCategory; // SUBSCRIPTION, QUOTA, SYSTEM, PAYMENT
    metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly gateway: NotificationGateway,
    ) { }

    /**
     * CORE LOGIC: Store & Forward
     * 1. Simpan notifikasi ke Database (Persistence)
     * 2. Emit ke Socket User (Real-time Feedback)
     */
    async createAndSend(dto: CreateNotificationDto) {
        try {
            // 1. Simpan ke DB
            const notification = await this.prisma.notification.create({
                data: {
                    userId: dto.userId,
                    title: dto.title,
                    message: dto.message,
                    type: dto.type,
                    category: dto.category,
                    metadata: dto.metadata || {},
                    isRead: false,
                },
            });

            // 2. Kirim Real-time via Socket
            // Event name: 'notification_new'
            this.gateway.sendToUser(dto.userId, 'notification_new', notification);

            return notification;
        } catch (error) {
            this.logger.error(`Failed to create notification for user ${dto.userId}`, error.stack);
            // Jangan throw error agar flow utama (misal: payment) tidak rollback hanya karena notif gagal
        }
    }

    // --- READ OPERATIONS (Untuk HTTP API) ---

    async getUserNotifications(userId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
        ]);

        const unreadCount = await this.prisma.notification.count({
            where: { userId, isRead: false },
        });

        return {
            data,
            meta: {
                total,
                page,
                lastPage: Math.ceil(total / limit),
                unreadCount,
            },
        };
    }

    async markAsRead(notificationId: string, userId: string) {
        return this.prisma.notification.updateMany({
            where: {
                id: notificationId,
                userId: userId, // Security check: Pastikan milik user sendiri
            },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
}