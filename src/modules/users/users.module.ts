import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SearchModule } from '../search/search.module'; // [PHASE 3] Import Module

@Module({
  imports: [SearchModule], // [PHASE 3] Daftarkan SearchModule disini
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService] // Best Practice: Export service jika module lain butuh
})
export class UsersModule {}