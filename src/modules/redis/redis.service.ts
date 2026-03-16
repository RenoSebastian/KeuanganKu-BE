import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ====================================================================
// [CONTRACTS] DATA STRUCTURES
// ====================================================================

export interface RedisSessionData {
    sessionId: string;
    deviceId: string;
    socketId: string | null;
    refreshTokenHash: string;
}

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
        this.sessionTtl = this.configService.get<number>('redis.sessionTtl', 86400);
    }

    // ====================================================================
    // GENERAL CACHING METHODS (Digunakan untuk Analytics, Master Data, dll)
    // ====================================================================

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        try {
            await this.redisClient.set(key, value, 'EX', ttlSeconds);
        } catch (error) {
            throw new InternalServerErrorException(`Gagal menyimpan cache memori untuk kunci: ${key}`);
        }
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.redisClient.get(key);
        } catch (error) {
            throw new InternalServerErrorException(`Gagal mengambil cache memori untuk kunci: ${key}`);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.redisClient.del(key);
        } catch (error) {
            throw new InternalServerErrorException(`Gagal menghapus cache memori untuk kunci: ${key}`);
        }
    }

    // ====================================================================
    // SESSION MANAGEMENT METHODS
    // ====================================================================

    private getKey(userId: string): string {
        return `${this.keyPrefix}session:${userId}`;
    }

    async setSession(userId: string, data: RedisSessionData): Promise<void> {
        try {
            const key = this.getKey(userId);
            const value = JSON.stringify(data);
            await this.redisClient.set(key, value, 'EX', this.sessionTtl);
        } catch (error) {
            throw new InternalServerErrorException('Gagal menyimpan state sesi ke lapisan memori');
        }
    }

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

    async deleteSession(userId: string): Promise<void> {
        try {
            const key = this.getKey(userId);
            await this.redisClient.del(key);
        } catch (error) {
            throw new InternalServerErrorException('Gagal menghapus sesi aktif');
        }
    }

    async updateSocketId(userId: string, socketId: string | null): Promise<void> {
        try {
            const session = await this.getSession(userId);
            if (session) {
                session.socketId = socketId;
                await this.setSession(userId, session);
            }
        } catch (error) {
            throw new InternalServerErrorException('Gagal memperbarui referensi koneksi Real-time');
        }
    }

    // ====================================================================
    // OTP MANAGEMENT METHODS (TEMPORARY STATE)
    // ====================================================================

    private getOtpKey(email: string): string {
        return `${this.keyPrefix}register:otp:${email}`;
    }

    async setOtp(email: string, data: RedisOtpData, ttlSeconds: number = 300): Promise<void> {
        try {
            const key = this.getOtpKey(email);
            const value = JSON.stringify(data);
            await this.redisClient.set(key, value, 'EX', ttlSeconds);
        } catch (error) {
            throw new InternalServerErrorException('Gagal menyimpan state OTP ke lapisan memori');
        }
    }

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

    async deleteOtp(email: string): Promise<void> {
        try {
            const key = this.getOtpKey(email);
            await this.redisClient.del(key);
        } catch (error) {
            throw new InternalServerErrorException('Gagal membersihkan state OTP aktif');
        }
    }
}