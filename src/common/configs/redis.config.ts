import { registerAs } from '@nestjs/config';

/**
 * Interface untuk mendefinisikan kontrak struktur konfigurasi Redis.
 * Ini memastikan Type Safety yang ketat saat konfigurasi dipanggil di Service.
 */
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    sessionTtl: number;
}

/**
 * RegisterAs 'redis' mengisolasi konfigurasi di dalam namespace 'redis'.
 * Fallback value (default) disediakan untuk menjaga sistem tetap fail-safe 
 * di environment lokal apabila environment variables lupa di-set.
 */
export default registerAs(
    'redis',
    (): RedisConfig => ({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),

        // Prefix untuk mencegah collision jika instance Redis digunakan oleh app lain
        keyPrefix: process.env.REDIS_PREFIX || 'keuanganku:',

        // TTL default untuk sesi aktif (dalam detik). 
        // 86400 detik = 1 Hari (Sama dengan umur Refresh Token jika tidak diperbarui)
        sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),
    }),
);