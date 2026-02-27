import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Kontrak struktur data yang masuk ke dalam memori Redis
export interface RedisSessionData {
    sessionId: string;
    deviceId: string;
    socketId: string | null;
    refreshTokenHash: string;
}

@Injectable()
export class RedisService {
    private readonly keyPrefix: string;
    private readonly sessionTtl: number;

    constructor(
        @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
        private readonly configService: ConfigService,
    ) {
        this.keyPrefix = this.configService.get<string>('redis.keyPrefix', 'keuanganku:');
        // TTL diset secara global dari config. Default 86400 (1 hari) jika tidak ada.
        this.sessionTtl = this.configService.get<number>('redis.sessionTtl', 86400);
    }

    /**
     * Menggenerasi kunci absolut untuk Redis.
     * Format: keuanganku:session:{userId}
     */
    private getKey(userId: string): string {
        return `${this.keyPrefix}session:${userId}`;
    }

    /**
     * Menyimpan atau menimpa (Overwrite) sesi aktif pengguna.
     * Otoritas Opsi B (Last-In Wins) dipicu dari eksekusi fungsi ini.
     */
    async setSession(userId: string, data: RedisSessionData): Promise<void> {
        try {
            const key = this.getKey(userId);
            const value = JSON.stringify(data);

            // 'EX' mengatur parameter kadaluwarsa dalam ukuran hitungan detik (seconds).
            await this.redisClient.set(key, value, 'EX', this.sessionTtl);
        } catch (error) {
            throw new InternalServerErrorException('Gagal menyimpan state sesi ke lapisan memori');
        }
    }

    /**
     * Mengambil data sesi pengguna.
     * Mengembalikan null jika pengguna tidak memiliki sesi aktif.
     */
    async getSession(userId: string): Promise<RedisSessionData | null> {
        try {
            const key = this.getKey(userId);
            const data = await this.redisClient.get(key);

            if (!data) return null;

            return JSON.parse(data) as RedisSessionData;
        } catch (error) {
            throw new InternalServerErrorException('Gagal mengambil state sesi dari lapisan memori');
        }
    }

    /**
     * Menghapus secara atomik sesi pengguna.
     * Dipanggil saat user logout secara sukarela atau saat masa berlaku RT telah kadaluwarsa penuh.
     */
    async deleteSession(userId: string): Promise<void> {
        try {
            const key = this.getKey(userId);
            await this.redisClient.del(key);
        } catch (error) {
            throw new InternalServerErrorException('Gagal menghapus sesi aktif');
        }
    }

    /**
     * Memperbarui secara parsial data Socket ID saat PWA/Aplikasi Mobile Resume dari Background
     * atau saat pengguna memuat ulang (refresh) halaman.
     */
    async updateSocketId(userId: string, socketId: string | null): Promise<void> {
        try {
            const session = await this.getSession(userId);

            if (session) {
                session.socketId = socketId;
                // Secara arsitektural, me-refresh koneksi socket adalah aktivitas valid.
                // Menulis ulang sesi ini akan mereset hitung mundur TTL (Time-To-Live).
                await this.setSession(userId, session);
            }
        } catch (error) {
            throw new InternalServerErrorException('Gagal memperbarui referensi koneksi Real-time');
        }
    }
}