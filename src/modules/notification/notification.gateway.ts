// src/modules/notification/notification.gateway.ts
import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'admin' })
export class NotificationGateway {
    @WebSocketServer()
    server: Server;

    // Method untuk dipanggil dari service lain
    sendNewOrderNotification(orderData: any) {
        this.server.emit('new_payment_uploaded', {
            message: `User ${orderData.clientName} baru saja upload bukti bayar!`,
            orderId: orderData.id,
            amount: orderData.amount,
        });
    }
}