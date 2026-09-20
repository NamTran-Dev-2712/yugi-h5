import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

/**
 * Skeleton for M7: duel rooms over Socket.io. Client -> server Actions and
 * server -> client GameEvents/StateView will be wired here once DuelService
 * (see duels module) exists. See docs/design/protocol.md for event contracts.
 */
@WebSocketGateway({ namespace: 'realtime', cors: true })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
