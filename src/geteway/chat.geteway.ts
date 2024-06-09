import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DialogService } from '../dialog/dialog.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*', // Настройте соответствующий источник
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(private readonly dialogService: DialogService) {}

  afterInit(_server: Server) {
    console.log('WebSocket initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { dialogId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    const senderId = Array.isArray(client.handshake.query.userId)
      ? client.handshake.query.userId[0]
      : client.handshake.query.userId;

    const message = await this.dialogService.sendMessage(
      data.dialogId,
      senderId,
      data.text,
    );
    this.server.to(data.dialogId).emit('receiveMessage', message);
  }

  @SubscribeMessage('joinDialog')
  handleJoinDialog(
    @MessageBody('dialogId') dialogId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(dialogId);
    console.log(`Client ${client.id} joined dialog ${dialogId}`);
  }
}
