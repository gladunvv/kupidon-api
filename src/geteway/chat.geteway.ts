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
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly dialogService: DialogService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    // Middleware для аутентификации
    server.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          throw new Error('No token provided');
        }

        const payload = this.jwtService.verify(token);
        socket.data.userId = payload.sub;
        socket.data.phone = payload.phone;

        this.logger.log(
          `Client authenticated: ${socket.id}, userId: ${payload.sub}`,
        );
        next();
      } catch (error) {
        this.logger.error(
          `Authentication failed for ${socket.id}: ${error.message}`,
        );
        next(new Error('Authentication failed'));
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connected: ${client.id}, userId: ${client.data.userId}`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected: ${client.id}, userId: ${client.data.userId}`,
    );
  }

  @SubscribeMessage('join_dialog')
  async handleJoinDialog(
    @MessageBody() data: { dialogId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { dialogId } = data;
      const userId = client.data.userId;

      if (!dialogId) {
        client.emit('error', { message: 'Dialog ID is required' });
        return;
      }

      // Проверяем, что пользователь имеет доступ к диалогу
      const dialog = await this.dialogService.getDialogWithPartner(
        dialogId,
        userId,
      );

      if (!dialog) {
        client.emit('error', { message: 'Dialog not found or access denied' });
        return;
      }

      await client.join(dialogId);
      this.logger.log(`Client ${client.id} joined dialog ${dialogId}`);

      client.emit('joined_dialog', {
        dialogId,
        success: true,
        partner: dialog.partner,
      });
    } catch (error) {
      this.logger.error(`Error joining dialog: ${error.message}`);
      client.emit('error', { message: 'Failed to join dialog' });
    }
  }

  @SubscribeMessage('leave_dialog')
  handleLeaveDialog(
    @MessageBody() data: { dialogId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { dialogId } = data;

    if (dialogId) {
      client.leave(dialogId);
      this.logger.log(`Client ${client.id} left dialog ${dialogId}`);

      client.emit('left_dialog', {
        dialogId,
        success: true,
      });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: { dialogId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { dialogId, text } = data;
      const userId = client.data.userId;

      if (!dialogId || !text || text.trim().length === 0) {
        client.emit('error', {
          message: 'Dialog ID and message text are required',
        });
        return;
      }

      // Сохраняем сообщение в базе данных
      const message = await this.dialogService.sendMessage(
        dialogId,
        userId,
        text.trim(),
      );

      // Отправляем сообщение всем участникам диалога (включая отправителя)
      this.server.to(dialogId).emit('new_message', {
        _id: message._id,
        text: message.text,
        sender: {
          _id: (message.sender as any)._id,
          name: (message.sender as any).name,
        },
        dialogId,
        created_at: (message as any).created_at,
        isFromCurrentUser: userId === (message.sender as any)._id.toString(),
      });

      this.logger.log(`Message sent in dialog ${dialogId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  // Вспомогательный метод для отправки уведомлений пользователю
  sendNotificationToUser(userId: string, event: string, data: any) {
    this.server.emit(`user_${userId}`, { event, data });
  }
}
