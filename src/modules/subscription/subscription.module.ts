import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { SubscriptionService } from './services/subscription.service';
import { AdminSubscriptionService } from './services/admin-subscription.service';
import { SubscriptionCronService } from './services/subscription-cron.service'; // [NEW IMPORT]
import { SubscriptionController } from './controllers/subscription.controller';
import { AdminSubscriptionController } from './controllers/admin-subscription.controller';
import { NotificationModule } from '../notification/notification.module';
import { UsersModule } from '../users/users.module'; // [REQUIRED]
import { AuditModule } from '../audit/audit.module'; // [REQUIRED]

@Module({
    imports: [
        PrismaModule,
        MediaModule,
        NotificationModule,
        forwardRef(() => UsersModule), 
    AuditModule,
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