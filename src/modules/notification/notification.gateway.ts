import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
    cors: {
        origin: '*', // Di produksi, ganti dengan URL Frontend spesifik
    },
    // Kita hapus namespace 'admin' agar bisa dipakai global (User & Admin)
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // --- 1. SECURITY & ROOM SETUP ---
    async handleConnection(client: Socket) {
        try {
            // Ambil token dari handshake auth atau headers
            const token =
                client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.split(' ')[1];

            if (!token) {
                this.logger.warn(`Client ${client.id} mencoba connect tanpa token.`);
                client.disconnect();
                return;
            }

            // Verifikasi Token
            const secret = this.configService.get<string>('JWT_SECRET');
            const payload = await this.jwtService.verifyAsync(token, { secret });

            // Jika valid, masukan user ke "Room Pribadi"
            const userId = payload.sub; // 'sub' biasanya berisi userId
            const roomName = `user_${userId}`;

            await client.join(roomName);

            this.logger.log(`Client ${client.id} (User: ${userId}) joined room: ${roomName}`);

            // Simpan userId di socket instance untuk referensi saat disconnect
            client.data.userId = userId;

        } catch (error) {
            this.logger.error(`Connection rejected for client ${client.id}: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client ${client.id} disconnected.`);
    }

    // --- 2. PUBLIC METHODS (Dipanggil oleh Service) ---

    /**
     * Kirim notifikasi real-time ke user spesifik
     */
    sendToUser(userId: string, event: string, data: any) {
        const roomName = `user_${userId}`;
        this.server.to(roomName).emit(event, data);
        this.logger.debug(`Event '${event}' sent to ${roomName}`);
    }

    /**
     * Kirim notifikasi ke semua Admin (misal: ada pembayaran baru)
     * Note: Asumsi Admin punya room khusus atau kita loop user admin
     * Untuk simplifikasi, kita bisa buat room 'admin_channel'
     */
    sendToAdmins(event: string, data: any) {
        // Logic join admin ke room 'admin_channel' harus ada di handleConnection
        // jika role === 'ADMIN'
        this.server.to('admin_channel').emit(event, data);
    }
}