import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ActiveSessionMiddleware implements NestMiddleware {
    private readonly logger = new Logger(ActiveSessionMiddleware.name);

    // Cache sederhana untuk debounce (mengurangi beban hit ke DB)
    // Format Key: userId_userAgent -> Value: timestamp last update
    private readonly updateThrottler = new Map<string, number>();
    private readonly THROTTLE_LIMIT_MS = 5 * 60 * 1000; // 5 Menit

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const token = this.extractToken(req);

        if (token) {
            // Jalankan tracking secara asinkron (Fire-and-Forget) agar tidak memblokir request utama
            this.handleSessionTracking(token, req).catch((err) => {
                // Suppress error log agar console tidak banjir jika ada glitch sesaat
                // this.logger.debug(`Session tracking skipped: ${err.message}`);
            });
        }

        next();
    }

    /**
     * Helper untuk mengambil Bearer Token dari Header Authorization
     */
    private extractToken(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
            return authHeader.split(' ')[1];
        }
        return null;
    }

    /**
     * Core Logic: Decode Token -> Cek Throttling -> Update DB ActiveSession
     */
    private async handleSessionTracking(token: string, req: Request) {
        try {
            // 1. Decode Token (Tanpa Verify Signature di sini demi kecepatan)
            // Validasi signature dilakukan oleh AuthGuard di layer berikutnya.
            const payload = this.jwtService.decode(token) as { sub: string } | null;

            if (!payload || !payload.sub) return;

            const userId = payload.sub;
            // Ambil User Agent, potong jika terlalu panjang
            const userAgent = (req.headers['user-agent'] || 'Unknown Device').substring(0, 255);
            // Ambil IP Address (support proxy/load balancer)
            const ipAddress = (
                (req.headers['x-forwarded-for'] as string) ||
                req.ip ||
                req.socket.remoteAddress ||
                'Unknown IP'
            ).split(',')[0].trim().substring(0, 45);

            // 2. Throttling Check (In-Memory)
            // Mencegah spam update ke database setiap kali user klik (cukup update per 5 menit)
            const throttleKey = `${userId}_${userAgent}`;
            const lastUpdate = this.updateThrottler.get(throttleKey);
            const now = Date.now();

            if (lastUpdate && now - lastUpdate < this.THROTTLE_LIMIT_MS) {
                return; // Skip database interaction
            }

            // 3. Database Sync (Upsert Logic Manual)
            // Cari sesi aktif untuk user di device yang sama
            const existingSession = await this.prisma.activeSession.findFirst({
                where: {
                    userId,
                    deviceInfo: userAgent,
                },
                select: { id: true }, // Hemat bandwidth DB
            });

            if (existingSession) {
                // Update waktu aktivitas terakhir
                await this.prisma.activeSession.update({
                    where: { id: existingSession.id },
                    data: {
                        lastActivityAt: new Date(),
                        ipAddress, // Update IP jaga-jaga user pindah jaringan (WiFi -> 4G)
                    },
                });
            } else {
                // Buat sesi baru jika belum ada
                await this.prisma.activeSession.create({
                    data: {
                        userId,
                        deviceInfo: userAgent,
                        ipAddress,
                        loginAt: new Date(),
                        lastActivityAt: new Date(),
                    },
                });
            }

            // 4. Update Cache Throttler
            this.updateThrottler.set(throttleKey, now);

            // Garbage Collection sederhana untuk mencegah memory leak pada Map
            if (this.updateThrottler.size > 10000) {
                this.updateThrottler.clear();
            }

        } catch (error) {
            // Fail-safe: Jangan biarkan error di middleware logging mematikan aplikasi
            // this.logger.warn(`Failed to track session: ${error.message}`);
        }
    }
}