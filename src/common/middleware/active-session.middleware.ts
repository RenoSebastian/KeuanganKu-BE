import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ActiveSessionMiddleware implements NestMiddleware {
    private readonly logger = new Logger(ActiveSessionMiddleware.name);

    // Cache sederhana untuk debounce (mengurangi beban hit ke DB)
    // Format Key: sessionId -> Value: timestamp last update
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
     * Core Logic: Decode Token -> Cek Throttling -> Update DB ActiveSession (Hanya UPDATE)
     */
    private async handleSessionTracking(token: string, req: Request) {
        try {
            // 1. Decode Token (Tanpa Verify Signature di sini demi kecepatan)
            // Validasi signature dilakukan oleh AuthGuard di layer berikutnya.
            const payload = this.jwtService.decode(token) as { sub: string; sessionId?: string; type?: string } | null;

            // Hanya proses jika payload valid, bertipe ACCESS, dan memiliki sessionId (SaaS standard)
            if (!payload || !payload.sub || !payload.sessionId || payload.type !== 'ACCESS') return;

            const sessionId = payload.sessionId;
            const ipAddress = (
                (req.headers['x-forwarded-for'] as string) ||
                req.ip ||
                req.socket.remoteAddress ||
                'Unknown IP'
            ).split(',')[0].trim().substring(0, 45);

            // 2. Throttling Check (In-Memory)
            // Mencegah spam update ke database setiap kali user klik (cukup update per 5 menit)
            const lastUpdate = this.updateThrottler.get(sessionId);
            const now = Date.now();

            if (lastUpdate && now - lastUpdate < this.THROTTLE_LIMIT_MS) {
                return; // Skip database interaction
            }

            // 3. Database Sync (HANYA UPDATE)
            // Sesi hanya diciptakan di AuthService saat Login. Middleware ini hanya memperpanjang riwayat.
            await this.prisma.activeSession.update({
                where: { sessionId: sessionId }, // sessionId kini menjadi unique identifier
                data: {
                    lastActivityAt: new Date(),
                    ipAddress, // Update IP jaga-jaga user pindah jaringan (WiFi -> 4G)
                },
            });

            // 4. Update Cache Throttler
            this.updateThrottler.set(sessionId, now);

            // Garbage Collection sederhana untuk mencegah memory leak pada Map
            if (this.updateThrottler.size > 10000) {
                this.updateThrottler.clear();
            }

        } catch (error: any) {
            // P2025 adalah kode error Prisma untuk "Record to update not found".
            // Ini WAJAR terjadi jika user sudah menekan tombol logout atau di-kick,
            // namun request yang sedang delay dari FE baru masuk. Abaikan error ini.
            if (error.code !== 'P2025') {
                // this.logger.warn(`Failed to track session: ${error.message}`);
            }
        }
    }
}