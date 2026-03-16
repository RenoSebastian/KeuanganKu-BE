import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SearchModule } from '../search/search.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UserQuotaService } from './services/user-quota.service';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';

// [PHASE 1 FIX] Import AdminUsersController
import { AdminUsersController } from './controllers/admin-users.controller';

@Module({
  imports: [
    SearchModule,
    forwardRef(() => SubscriptionModule),
    RedisModule,
    AuditModule,
  ],
  controllers: [
    UsersController,
    AdminUsersController // [PHASE 1 FIX] Daftarkan controller Admin agar dikenali oleh Router
  ],
  providers: [
    UsersService,
    UserQuotaService,
  ],
  exports: [
    UsersService,
    UserQuotaService,
  ],
})
export class UsersModule { }