import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ====================================================================
// [CONTRACTS] DATA STRUCTURES
// ====================================================================

// Kontrak struktur data yang masuk ke dalam memori Redis untuk Sesi Aktif
export interface RedisSessionData {
    sessionId: string;
    deviceId: string;
    socketId: string | null;
    refreshTokenHash: string;
}

// [NEW] Kontrak struktur data sementara untuk pendaftaran berbasis OTP
export interface RedisOtpData {
    email: string;
    fullName: string;
    passwordHash: string;
    otpCode: string;
    resendCount: number;
    lastSentAt: number;
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

    // ====================================================================
    // SESSION MANAGEMENT METHODS
    // ====================================================================

    /**
     * Menggenerasi kunci absolut untuk Redis Sesi.
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

    // ====================================================================
    // [NEW] OTP MANAGEMENT METHODS (TEMPORARY STATE)
    // ====================================================================

    /**
     * Menggenerasi kunci spesifik untuk penyimpanan OTP di Redis.
     * Format: keuanganku:register:otp:{email}
     */
    private getOtpKey(email: string): string {
        return `${this.keyPrefix}register:otp:${email}`;
    }

    /**
     * Menyimpan data pendaftaran sementara beserta kode OTP ke memori.
     * @param email Email pengguna (sebagai identifier kunci)
     * @param data Payload data registrasi dan OTP (mematuhi interface RedisOtpData)
     * @param ttlSeconds Masa aktif OTP dalam hitungan detik (default 300 detik / 5 menit)
     */
    async setOtp(email: string, data: RedisOtpData, ttlSeconds: number = 300): Promise<void> {
        try {
            const key = this.getOtpKey(email);
            const value = JSON.stringify(data);

            await this.redisClient.set(key, value, 'EX', ttlSeconds);
        } catch (error) {
            throw new InternalServerErrorException('Gagal menyimpan state OTP ke lapisan memori');
        }
    }

    /**
     * Mengambil data sementara OTP pengguna berdasarkan email.
     * @returns RedisOtpData jika masih dalam masa TTL, atau null jika sudah kadaluwarsa/tidak ada.
     */
    async getOtp(email: string): Promise<RedisOtpData | null> {
        try {
            const key = this.getOtpKey(email);
            const data = await this.redisClient.get(key);

            if (!data) return null;

            return JSON.parse(data) as RedisOtpData;
        } catch (error) {
            throw new InternalServerErrorException('Gagal mengambil state OTP dari lapisan memori');
        }
    }

    /**
     * Menghapus data OTP pengguna.
     * Digunakan sebagai aksi Idempotency setelah OTP berhasil diverifikasi agar tidak bisa dipakai ulang.
     */
    async deleteOtp(email: string): Promise<void> {
        try {
            const key = this.getOtpKey(email);
            await this.redisClient.del(key);
        } catch (error) {
            throw new InternalServerErrorException('Gagal membersihkan state OTP aktif');
        }
    }
}