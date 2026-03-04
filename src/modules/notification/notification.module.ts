import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// [NOTE] @Global() membuat module ini bisa dipakai di mana saja tanpa perlu imports berulang
// Namun, untuk best practice Clean Architecture, kita tetap akan import manual di module yang butuh.
@Module({
    imports: [
        PrismaModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [NotificationController],
    providers: [NotificationService, NotificationGateway],

    // [MODIFIED] Mengekspor NotificationGateway sangat krusial di sini.
    // Ini membuka jalur akses agar AuthService dapat memanggil metode forceDisconnectClient()
    // untuk mengamankan ekosistem Single Concurrent Session.
    exports: [NotificationService, NotificationGateway],
})
export class NotificationModule { }