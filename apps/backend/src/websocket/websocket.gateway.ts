import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: '*',
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WsGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      // Track user's sockets
      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);

      client.join(`user:${payload.sub}`);

      // Auto-join admin room for ADMIN users
      if (payload.role === 'ADMIN') {
        client.join('room:admin');
        this.logger.log(`Admin client joined room:admin: ${client.id}`);
      }

      client.emit('authenticated', { success: true });

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub}, role: ${payload.role})`);
    } catch {
      client.emit('authenticated', { success: false });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(client.id);
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:prices')
  handleSubscribePrices(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { symbols: string[] },
  ) {
    const names = data.symbols ?? (data as any).symbolIds ?? [];
    for (const name of names) {
      client.join(`price:${name}`);
    }
    this.logger.log(
      `Client ${client.id} subscribed to prices: ${names.join(', ')}`,
    );
    return { event: 'subscribed', data: { symbols: names } };
  }

  @SubscribeMessage('unsubscribe:prices')
  handleUnsubscribePrices(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { symbols: string[] },
  ) {
    const names = data.symbols ?? (data as any).symbolIds ?? [];
    for (const name of names) {
      client.leave(`price:${name}`);
    }
  }

  @SubscribeMessage('subscribe:trade')
  handleSubscribeTrade(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tradeId: string },
  ) {
    client.join(`trade:${data.tradeId}`);
  }

  @SubscribeMessage('unsubscribe:trade')
  handleUnsubscribeTrade(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tradeId: string },
  ) {
    client.leave(`trade:${data.tradeId}`);
  }

  // --- Methods called by other services ---

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitPriceUpdate(symbolId: string, priceData: any) {
    this.server.to(`price:${symbolId}`).emit('price:update', priceData);
  }

  emitTradePnl(tradeId: string, pnlData: any) {
    this.server.to(`trade:${tradeId}`).emit('trade:pnl', pnlData);
  }

  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // --- Admin-specific methods ---

  /** Emit to all connected admin clients */
  emitToAdmins(event: string, data: any) {
    this.server.to('room:admin').emit(event, data);
  }

  /** Notify admins of a trade opened */
  emitAdminTradeOpened(trade: any) {
    this.emitToAdmins('admin:trade:opened', trade);
  }

  /** Notify admins of a trade closed */
  emitAdminTradeClosed(trade: any) {
    this.emitToAdmins('admin:trade:closed', trade);
  }

  /** Stream P&L update to admins */
  emitAdminTradePnl(pnlData: any) {
    this.emitToAdmins('admin:trade:pnl', pnlData);
  }

  /** Stream MT5 positions to admins */
  emitAdminMtPositions(positions: any[]) {
    this.emitToAdmins('admin:mt:positions', positions);
  }

  /** Stream price updates to admins */
  emitAdminPriceUpdate(prices: any[]) {
    this.emitToAdmins('admin:prices', prices);
  }
}
