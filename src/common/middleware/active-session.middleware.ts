import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ActiveSessionMiddleware implements NestMiddleware {
    private readonly logger = new Logger(ActiveSessionMiddleware.name);

    // Cache sederhana untuk debounce (opsional, untuk mengurangi hit ke DB findFirst)
    // Format: userId_userAgent -> timestamp
    private readonly updateThrottler = new Map<string, number>();
    private readonly THROTTLE_LIMIT_MS = 5 * 60 * 1000; // 5 Menit

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async use(req: Request, res: Response, next: NextFunction) {
        const token = this.extractToken(req);

        if (token) {
            // Jalankan tracking secara asinkron (Fire-and-Forget)
            // Kita tidak menggunakan 'await' agar response time aplikasi tidak terbebani
            this.handleSessionTracking(token, req).catch((err) => {
                // Suppress error log agar console tidak banjir jika ada glitch sesaat
                // this.logger.debug(`Tracking error: ${err.message}`);
            });
        }

        next();
    }

    /**
     * Helper untuk mengambil Bearer Token dari Header
     */
    private extractToken(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
            return authHeader.split(' ')[1];
        }
        return null;
    }

    /**
     * Core Logic: Decode Token -> Cek Throttling -> Update DB
     */
    private async handleSessionTracking(token: string, req: Request) {
        try {
            // 1. Decode Token (Tanpa Verify Signature agar cepat)
            // Keamanan tetap terjamin karena AuthGuard akan memvalidasi signature di layer berikutnya.
            // Di sini kita hanya butuh ID untuk tracking "potential valid user".
            const payload = this.jwtService.decode(token) as { sub: string } | null;

            if (!payload || !payload.sub) return;

            const userId = payload.sub;
            const userAgent = (req.headers['user-agent'] || 'Unknown Device').substring(0, 255); // Truncate agar muat di DB
            const ipAddress = (req.ip || req.socket.remoteAddress || 'Unknown IP').substring(0, 45);

            // 2. Throttling Check (In-Memory)
            // Cek apakah user+device ini baru saja diupdate < 5 menit lalu?
            const throttleKey = `${userId}_${userAgent}`;
            const lastUpdate = this.updateThrottler.get(throttleKey);
            const now = Date.now();

            if (lastUpdate && now - lastUpdate < this.THROTTLE_LIMIT_MS) {
                return; // Skip database update
            }

            // 3. Database Sync (Upsert Logic)
            // Kita cari session aktif untuk user & device yang sama
            const existingSession = await this.prisma.activeSession.findFirst({
                where: {
                    userId,
                    deviceInfo: userAgent,
                },
                select: { id: true, lastActivityAt: true },
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
                // Buat session baru jika belum ada (atau session lama terhapus cleanup cron)
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

            // Update Throttler Cache
            this.updateThrottler.set(throttleKey, now);

            // Clean up memory cache (simple garbage collection logic)
            if (this.updateThrottler.size > 10000) {
                this.updateThrottler.clear(); // Reset jika terlalu penuh untuk mencegah memory leak
            }

        } catch (error) {
            // Ignore error (fail-safe)
        }
    }
}