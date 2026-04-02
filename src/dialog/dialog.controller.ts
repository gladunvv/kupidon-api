import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Post,
  Body,
} from '@nestjs/common';
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
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';

@ApiTags('Dialogs')
@ApiBearerAuth()
@Controller('dialogs')
export class DialogController {
  constructor(private readonly dialogService: DialogService) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user dialogs' })
  @ResponseMessage('Dialogs retrieved successfully')
  @Get()
  async getUserDialogs(@Req() req) {
    const userId = req.user._id;

    return await this.dialogService.getUserDialogs(userId);
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
  async getDialog(@Param('id', ParseObjectIdPipe) id: string, @Req() req) {
    const userId = req.user._id;
    const dialog = await this.dialogService.getDialogWithPartner(id, userId);

    return dialog;
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get dialog messages only' })
  @ApiParam({ name: 'id', example: '66123456789abcdef0123456' })
  @ResponseMessage('Messages retrieved successfully')
  @Get(':id/messages')
  async getMessages(@Param('id', ParseObjectIdPipe) id: string, @Req() req) {
    const userId = req.user._id;
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
    @Req() req,
  ) {
    const userId = req.user._id;
    return await this.dialogService.sendMessage(id, userId, dto.text);
  }
}
