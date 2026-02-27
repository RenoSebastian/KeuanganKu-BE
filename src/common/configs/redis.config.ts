import { registerAs } from '@nestjs/config';

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    sessionTtl: number;
    tls: boolean; // [FIX] Tambahkan properti TLS
}

export default registerAs(
    'redis',
    (): RedisConfig => ({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        keyPrefix: process.env.REDIS_PREFIX || 'keuanganku:',
        sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),
        // [FIX] Tangkap environment variable TLS, jadikan false sebagai fallback aman
        tls: process.env.REDIS_TLS === 'true',
    }),
);