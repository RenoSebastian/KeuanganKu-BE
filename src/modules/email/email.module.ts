import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * EmailModule
 * Pattern: Information Expert & Low Coupling (GRASP)
 * * Modul ini di-set sebagai @Global() (opsional, namun direkomendasikan untuk modul utilitas inti)
 * agar EmailService dapat langsung diinjeksi ke seluruh modul domain (Auth, Users, dll)
 * tanpa perlu mendeklarasikan EmailModule berulang kali di setiap array 'imports' modul lain.
 */
@Global()
@Module({
    imports: [
        // Inisialisasi asinkronus untuk memastikan ConfigService sudah siap membaca .env
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                transport: {
                    host: configService.get<string>('SMTP_HOST'),
                    port: configService.get<number>('SMTP_PORT'),
                    // secure: true wajib untuk port 465 (Implicit SSL/TLS)
                    // Jika di masa depan menggunakan port 587 (STARTTLS), ubah menjadi false
                    secure: true,
                    auth: {
                        user: configService.get<string>('SMTP_USER'),
                        pass: configService.get<string>('SMTP_PASS'),
                    },
                    // Optimalisasi koneksi jaringan
                    pool: true,
                    maxConnections: 5,
                    maxMessages: 100,
                },
                defaults: {
                    from: configService.get<string>('SMTP_FROM'),
                },
            }),
        }),
    ],
    providers: [EmailService],
    // Mengekspor EmailService agar menjadi public API dari modul ini (High Cohesion)
    exports: [EmailService],
})
export class EmailModule { }