import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { SubscriptionService } from './services/subscription.service';
import { AdminSubscriptionService } from './services/admin-subscription.service';
import { SubscriptionCronService } from './services/subscription-cron.service'; // [NEW IMPORT]
import { SubscriptionController } from './controllers/subscription.controller';
import { AdminSubscriptionController } from './controllers/admin-subscription.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        PrismaModule,
        MediaModule,
        NotificationModule
    ],
    controllers: [
        SubscriptionController,
        AdminSubscriptionController,
    ],
    providers: [
        SubscriptionService,
        AdminSubscriptionService,
        SubscriptionCronService, // [NEW REGISTER] Wajib ada agar Cron berjalan
    ],
    exports: [
        SubscriptionService,
    ],
})
export class SubscriptionModule { }