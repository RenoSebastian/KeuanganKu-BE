import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SearchModule } from '../search/search.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    // [PHASE 3] Search Engine Integration
    SearchModule,
    // Menggunakan forwardRef jika ada circular dependency dengan Subscription
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }