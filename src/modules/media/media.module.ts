import { Module } from '@nestjs/common';
import { MediaController } from './controllers/media.controller';
import { MediaStorageService } from './services/media-storage.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    controllers: [MediaController],
    providers: [MediaStorageService],
    exports: [MediaStorageService], // Export service agar bisa dipanggil oleh module lain
})
export class MediaModule { }