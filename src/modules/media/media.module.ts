import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaController } from './controllers/media.controller';
import { MediaStorageService } from './services/media-storage.service';

@Module({
    imports: [ConfigModule],
    controllers: [MediaController],
    providers: [MediaStorageService],
    exports: [MediaStorageService], // Export agar modul lain bisa pakai (misal: User Profile Pic)
})
export class MediaModule { }