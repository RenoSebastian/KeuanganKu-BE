import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SearchModule } from '../search/search.module';
import { SubscriptionModule } from '../subscription/subscription.module';
// [FIX] Import UserQuotaService
import { UserQuotaService } from './services/user-quota.service';

@Module({
  imports: [
    SearchModule,
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserQuotaService, // [FIX] Daftarkan sebagai Provider
  ],
  exports: [
    UsersService,
    UserQuotaService, // [FIX] Export agar bisa dipakai di SubscriptionModule
  ],
})
export class UsersModule { }