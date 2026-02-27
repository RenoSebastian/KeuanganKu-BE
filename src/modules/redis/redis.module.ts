import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
    providers: [
        {
            provide: 'REDIS_CLIENT',
            useFactory: (configService: ConfigService) => {
                const host = configService.get<string>('redis.host');
                const port = configService.get<number>('redis.port');
                const password = configService.get<string>('redis.password');
                const db = configService.get<number>('redis.db');

                // Instansiasi koneksi ke Redis
                const client = new Redis({
                    host,
                    port,
                    password,
                    db,
                    retryStrategy(times) {
                        // Logika deterministik: Jika redis mati, coba reconnect setiap (times * 50) ms.
                        // Maksimum delay adalah 2 detik untuk menghindari overload memori.
                        const delay = Math.min(times * 50, 2000);
                        return delay;
                    },
                });

                // Event listener pasif untuk memudahkan debugging di console backend
                client.on('error', (err) => {
                    console.error('[Redis Error] Gagal terhubung ke Redis:', err.message);
                });

                client.on('connect', () => {
                    console.log('[Redis] Berhasil terhubung ke In-Memory Storage');
                });

                return client;
            },
            inject: [ConfigService],
        },
        RedisService,
    ],
    exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }