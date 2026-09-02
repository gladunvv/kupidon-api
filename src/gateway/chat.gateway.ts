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
import { Logger, NotFoundException, Optional } from '@nestjs/common';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { runWithRequestId } from '../core/logging/request-context';
import { MetricsService } from '../observability/metrics.service';
import { ERROR_CODES } from '../core/http/error-codes';
import { DialogIdDto } from './dto/dialog-id.dto';
import { WsSendMessageDto } from './dto/ws-send-message.dto';
import { WsValidationError, validateWsPayload } from './ws-validate';
import { WsRateLimiter } from './ws-rate-limiter';

// 10 messages per 10s per user is a generous chat pace while still
// blocking a client (or bug) from hammering the DB and every dialog
// participant's socket.
const SEND_MESSAGE_LIMIT = { maxEvents: 10, windowMs: 10_000 };

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly sendMessageLimiter = new WsRateLimiter(
    SEND_MESSAGE_LIMIT.maxEvents,
    SEND_MESSAGE_LIMIT.windowMs,
  );

  constructor(
    private readonly dialogService: DialogService,
    private readonly jwtService: JwtService,
    @Optional() private readonly metricsService?: MetricsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    server.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
          throw new Error('No token provided');
        }

        const payload = this.jwtService.verify<{
          sub?: string;
          phone?: string;
          type?: string;
        }>(token);

        if (
          payload.type !== 'access' ||
          typeof payload.sub !== 'string' ||
          payload.sub.length === 0
        ) {
          throw new Error('Invalid access token');
        }

        socket.data.userId = payload.sub;
        socket.data.phone = payload.phone;
        socket.data.connectionId = uuidv4();

        runWithRequestId(socket.data.connectionId, () => {
          this.logger.log(
            `Client authenticated: ${socket.id}, userId: ${payload.sub}`,
          );
        });
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
    this.metricsService?.websocketConnections.inc();
    runWithRequestId(client.data.connectionId, () => {
      this.logger.log(
        `Client connected: ${client.id}, userId: ${client.data.userId}`,
      );
    });
  }

  handleDisconnect(client: Socket) {
    this.metricsService?.websocketConnections.dec();
    // Bounds the rate-limit map to currently-connected users instead of
    // growing for every user who has ever connected.
    if (client.data.userId) {
      this.sendMessageLimiter.reset(client.data.userId);
    }
    runWithRequestId(client.data.connectionId, () => {
      this.logger.log(
        `Client disconnected: ${client.id}, userId: ${client.data.userId}`,
      );
    });
  }

  @SubscribeMessage('join_dialog')
  handleJoinDialog(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    return runWithRequestId(client.data.connectionId, async () => {
      try {
        const dto = validateWsPayload(DialogIdDto, data);
        const userId = client.data.userId;

        // No message history is replayed on join — that's what
        // GET /dialogs/:id/messages is for (CHAT-01). Joining only
        // subscribes the socket to future broadcasts, so a client that
        // was offline never gets messages twice.
        const dialog = await this.dialogService.getDialogWithPartner(
          dto.dialogId,
          userId,
        );

        await client.join(dto.dialogId);
        this.logger.log(`Client ${client.id} joined dialog ${dto.dialogId}`);

        client.emit('joined_dialog', {
          dialogId: dto.dialogId,
          success: true,
          partner: dialog.partner,
        });
      } catch (error) {
        this.emitError(client, error, 'join_dialog');
      }
    });
  }

  @SubscribeMessage('leave_dialog')
  handleLeaveDialog(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    return runWithRequestId(client.data.connectionId, async () => {
      try {
        const dto = validateWsPayload(DialogIdDto, data);

        await client.leave(dto.dialogId);
        this.logger.log(`Client ${client.id} left dialog ${dto.dialogId}`);

        client.emit('left_dialog', { dialogId: dto.dialogId, success: true });
      } catch (error) {
        this.emitError(client, error, 'leave_dialog');
      }
    });
  }

  @SubscribeMessage('send_message')
  handleSendMessage(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    return runWithRequestId(client.data.connectionId, async () => {
      try {
        const userId = client.data.userId;

        if (!this.sendMessageLimiter.tryConsume(userId)) {
          client.emit('chat_error', {
            code: ERROR_CODES.TOO_MANY_MESSAGES,
            message: 'Too many messages, please slow down',
          });
          return;
        }

        const dto = validateWsPayload(WsSendMessageDto, data);
        const message = await this.dialogService.sendMessage(
          dto.dialogId,
          userId,
          dto.text,
        );

        const sender = message.sender as unknown as {
          _id: Types.ObjectId;
          name: string;
        };
        const senderId = sender._id.toString();

        this.server.to(dto.dialogId).emit('new_message', {
          _id: message._id,
          text: message.text,
          sender: {
            _id: sender._id,
            name: sender.name,
          },
          dialogId: dto.dialogId,
          created_at: message.created_at,
          isFromCurrentUser: userId === senderId,
        });

        this.logger.log(
          `Message sent in dialog ${dto.dialogId} by user ${userId}`,
        );
      } catch (error) {
        this.emitError(client, error, 'send_message');
      }
    });
  }

  // Single mapping from "what went wrong" to the same {code, message}
  // shape every HTTP error response already uses (see error-codes.ts),
  // so clients don't need a second error vocabulary for the WS transport.
  private emitError(client: Socket, error: unknown, context: string): void {
    if (error instanceof WsValidationError) {
      client.emit('chat_error', {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error.message,
      });
      return;
    }

    if (error instanceof NotFoundException) {
      client.emit('chat_error', {
        code: ERROR_CODES.NOT_FOUND,
        message: error.message,
      });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`${context} failed: ${message}`);
    client.emit('chat_error', {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong',
    });
  }

  // TODO
  // sendNotificationToUser(userId: string, event: string, data: unknown) {
  //   this.server.emit(`user_${userId}`, { event, data });
  // }
}
