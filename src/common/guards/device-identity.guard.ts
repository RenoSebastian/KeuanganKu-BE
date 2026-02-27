// File: src/common/guards/device-identity.guard.ts

import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { RedisService } from '../../modules/redis/redis.service';

/**
 * DeviceIdentityGuard
 * * Bertugas memvalidasi konsistensi antara Device ID yang mengirimkan request
 * dengan Device ID yang terdaftar sebagai otoritas sesi aktif di Redis.
 * Guard ini idealnya dijalankan SETELAH JwtAuthGuard.
 */
@Injectable()
export class DeviceIdentityGuard implements CanActivate {
    private readonly logger = new Logger(DeviceIdentityGuard.name);

    constructor(private readonly redisService: RedisService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // =================================================================
        // 1. EKSTRAKSI KONTRAK HEADER
        // =================================================================
        const deviceIdHeader = request.headers['x-device-id'];

        if (!deviceIdHeader) {
            throw new BadRequestException(
                'Integritas sistem menolak request: Header X-Device-ID wajib disertakan untuk rute terproteksi ini.'
            );
        }

        // =================================================================
        // 2. EKSTRAKSI KONTEKS PENGGUNA (Dari JwtStrategy)
        // =================================================================
        const user = request.user;
        if (!user || !user.id) {
            // Secara logis ini tidak akan terpanggil jika Guard dipasang setelah JwtAuthGuard,
            // namun kita menuliskannya untuk memenuhi prinsip Defensive Programming.
            throw new UnauthorizedException('Identitas pengguna tidak valid.');
        }

        // =================================================================
        // 3. EVALUASI STATE (REDIS)
        // =================================================================
        const activeSession = await this.redisService.getSession(user.id);

        if (!activeSession) {
            throw new UnauthorizedException('Sesi tidak ditemukan di lapisan memori. Silakan otentikasi ulang.');
        }

        // =================================================================
        // 4. KEPUTUSAN OTORISASI (FINGERPRINT MATCHING)
        // =================================================================
        if (activeSession.deviceId !== deviceIdHeader) {
            this.logger.warn(
                `[Security Alert] Anomali perangkat terdeteksi pada User ID: ${user.id}. ` +
                `Expected: ${activeSession.deviceId}, Received: ${deviceIdHeader}`
            );

            // [STRICT MODE - OPTIONAL] 
            // Jika Anda ingin sistem menjadi sangat agresif, ketika ada yang mencoba
            // menggunakan token di device lain, kita langsung hanguskan sesinya di Redis.
            // await this.redisService.deleteSession(user.id);

            throw new UnauthorizedException(
                'Akses ditolak (Device Mismatch). Sesi Anda sah, namun identitas perangkat tidak dikenali sebagai pemilik sesi.'
            );
        }

        // Lolos semua pemeriksaan
        return true;
    }
}