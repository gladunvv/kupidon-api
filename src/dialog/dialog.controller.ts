import { Controller, Get, Param, UseGuards, Post, Body } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { JwtAuthGuard } from '../auth/guards/auth-guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateDialogDto } from './dto/dialog-create.dto';
import { SendMessageDto } from './dto/dialog-send-message.dto';
import { ParseObjectIdPipe } from '../core/pipes/parse-object-id.pipe';
import { ResponseMessage } from '../core/decorators/response-message.decorator';
import { CurrentUser } from '../core/decorators/current-user.decorator';

@ApiTags('Dialogs')
@ApiBearerAuth()
@Controller('dialogs')
export class DialogController {
  constructor(private readonly dialogService: DialogService) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user dialogs' })
  @ResponseMessage('Dialogs retrieved successfully')
  @Get()
  async getUserDialogs(@CurrentUser('_id') userId: string) {
    return this.dialogService.getUserDialogs(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create dialog from match' })
  @ResponseMessage('Dialog created successfully')
  @Post('create')
  async createDialog(@Body() dto: CreateDialogDto) {
    return await this.dialogService.createDialog(dto.matchId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get dialog with partner and messages' })
  @ApiParam({ name: 'id', example: '66123456789abcdef0123456' })
  @ResponseMessage('Dialog retrieved successfully')
  @Get(':id')
  async getDialog(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
  ) {
    return this.dialogService.getDialogWithPartner(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get dialog messages only' })
  @ApiParam({ name: 'id', example: '66123456789abcdef0123456' })
  @ResponseMessage('Messages retrieved successfully')
  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('_id') userId: string,
  ) {
    const dialog = await this.dialogService.getDialogWithPartner(id, userId);

    return {
      messages: dialog.messages,
      partner: dialog.partner,
      messagesCount: dialog.messagesCount,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send message to dialog' })
  @ApiParam({ name: 'id', example: '66123456789abcdef0123456' })
  @ResponseMessage('Message sent successfully')
  @Post(':id/messages')
  async sendMessage(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('_id') userId: string,
  ) {
    return this.dialogService.sendMessage(id, userId, dto.text);
  }
}
