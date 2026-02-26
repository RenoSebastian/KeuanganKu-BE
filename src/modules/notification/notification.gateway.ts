import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Constants untuk nama Room agar konsisten
const ROOMS = {
    ADMIN_DASHBOARD: 'admin-dashboard',
    DIRECTOR_DASHBOARD: 'director-dashboard',
    USER_PREFIX: 'user:',
};

@WebSocketGateway({
    cors: {
        origin: '*', // [PRODUCTION] Ganti dengan URL Frontend spesifik saat deploy
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 60000, // Menjaga koneksi tetap hidup
})
export class NotificationGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationGateway.name);

    // Menyimpan mapping userId -> socketId (Opsional, untuk tracking manual in-memory)
    private activeUsers: Map<string, string> = new Map();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // =================================================================
    // 1. CONNECTION HANDLER (Security & Room Assignment)
    // =================================================================

    async handleConnection(@ConnectedSocket() client: Socket) {
        try {
            const token = this.extractToken(client);

            if (!token) {
                throw new UnauthorizedException('Token not found');
            }

            // Verifikasi Token
            const secret = this.configService.get<string>('JWT_SECRET');
            const payload = await this.jwtService.verifyAsync(token, { secret });

            const userId = payload.sub;
            const role = payload.role;

            // 1. Join Personal Room (untuk notifikasi spesifik user)
            const userRoom = `${ROOMS.USER_PREFIX}${userId}`;
            await client.join(userRoom);

            // 2. Join Role-Based Rooms (untuk fitur Live Monitoring & Feed)
            if (role === 'ADMIN') {
                await client.join(ROOMS.ADMIN_DASHBOARD);
                this.logger.log(`Admin ${userId} joined dashboard room.`);
            } else if (role === 'DIRECTOR') {
                await client.join(ROOMS.DIRECTOR_DASHBOARD);
            }

            // 3. Update State Local (Bisa di-extend ke Redis untuk scale-out)
            client.data.userId = userId;
            client.data.role = role;
            this.activeUsers.set(userId, client.id);

            this.logger.log(
                `Client connected: ${client.id} | User: ${userId} | Role: ${role}`,
            );

            // [OPTIONAL] Emit event 'user_online' ke Admin Dashboard
            this.broadcastToAdmins('user_status', { userId, status: 'ONLINE' });

        } catch (error) {
            this.logger.warn(
                `Connection rejected for client ${client.id}: ${error.message}`,
            );
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (userId) {
            this.activeUsers.delete(userId);
            this.logger.log(`Client disconnected: ${client.id} | User: ${userId}`);

            // [OPTIONAL] Emit event 'user_offline' ke Admin Dashboard
            this.broadcastToAdmins('user_status', { userId, status: 'OFFLINE' });
        }
    }

    // =================================================================
    // 2. PUBLIC METHODS (Dipanggil oleh Services lain)
    // =================================================================

    /**
     * Kirim notifikasi real-time ke user spesifik (Personal Notification)
     * Contoh: "Pembayaran Anda Diterima"
     */
    sendToUser(userId: string, event: string, data: any) {
        const roomName = `${ROOMS.USER_PREFIX}${userId}`;
        this.server.to(roomName).emit(event, data);
        this.logger.debug(`[Direct] Event '${event}' sent to ${userId}`);
    }

    /**
     * Kirim notifikasi ke semua Admin yang sedang online (Live Feed)
     * Contoh: "User A baru saja mengupload bukti bayar"
     */
    broadcastToAdmins(event: string, data: any) {
        this.server.to(ROOMS.ADMIN_DASHBOARD).emit(event, data);
        this.logger.debug(`[Broadcast Admin] Event '${event}' sent.`);
    }

    /**
     * Kirim notifikasi ke semua Director (Executive Dashboard)
     * Contoh: "Omset harian mencapai target"
     */
    broadcastToDirectors(event: string, data: any) {
        this.server.to(ROOMS.DIRECTOR_DASHBOARD).emit(event, data);
    }

    /**
     * Kirim notifikasi ke seluruh user yang terkoneksi (System Announcement)
     * Contoh: "Maintenance Server dalam 10 menit"
     */
    broadcastGlobal(event: string, data: any) {
        this.server.emit(event, data);
        this.logger.warn(`[Broadcast Global] Event '${event}' sent.`);
    }

    // =================================================================
    // 3. HELPER METHODS
    // =================================================================

    private extractToken(client: Socket): string | null {
        // 1. Cek Handshake Auth (Standard Socket.io v4)
        if (client.handshake.auth?.token) {
            return client.handshake.auth.token;
        }

        // 2. Cek Authorization Header (Fallback)
        const authHeader = client.handshake.headers?.authorization;
        if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
            return authHeader.split(' ')[1];
        }

        // 3. Cek Query Param (Fallback terakhir untuk klien legacy)
        if (client.handshake.query?.token) {
            return client.handshake.query.token as string;
        }

        return null;
    }
}