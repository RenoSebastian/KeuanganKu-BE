import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
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
                const isTls = configService.get<boolean>('redis.tls'); // Ambil flag TLS

                // [FIX] Siapkan objek opsi dasar
                const redisOptions: RedisOptions = {
                    host,
                    port,
                    password,
                    db,
                    retryStrategy(times) {
                        return Math.min(times * 50, 2000);
                    },
                };

                // [FIX] Injeksi parameter TLS kosong jika diaktifkan (syarat mutlak untuk Upstash)
                if (isTls) {
                    redisOptions.tls = {};
                }

                // Instansiasi koneksi ke Redis dengan opsi yang sudah disesuaikan
                const client = new Redis(redisOptions);

                client.on('error', (err) => {
                    console.error('[Redis Error] Gagal terhubung ke Redis:', err.message);
                });

                client.on('connect', () => {
                    console.log(`[Redis] Berhasil terhubung ke In-Memory Storage (${isTls ? 'TLS/Secure' : 'Plaintext'})`);
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