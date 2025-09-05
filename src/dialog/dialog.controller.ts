import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { DialogService } from './dialog.service';
import { JwtAuthGuard } from '../auth/guards/auth-guard';
import { ResponseHelper } from '../core/utils/response.helper';
import { Types } from 'mongoose';

@Controller('dialogs')
export class DialogController {
  constructor(private readonly dialogService: DialogService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getDialog(@Param('id') id: string, @Req() req) {
    // Валидируем ObjectId
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid dialog ID format');
    }

    const userId = req.user._id;
    const dialog = await this.dialogService.getDialogWithPartner(id, userId);

    return ResponseHelper.success(dialog, 'Dialog retrieved successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/messages')
  async getMessages(@Param('id') id: string, @Req() req) {
    // Валидируем ObjectId
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid dialog ID format');
    }

    const userId = req.user._id;
    const dialog = await this.dialogService.getDialogWithPartner(id, userId);

    return ResponseHelper.success(
      {
        messages: dialog.messages,
        partner: dialog.partner,
        messagesCount: dialog.messagesCount,
      },
      'Messages retrieved successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserDialogs(@Req() req) {
    const userId = req.user._id;
    const dialogs = await this.dialogService.getUserDialogs(userId);

    return ResponseHelper.success(dialogs, 'Dialogs retrieved successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body('text') text: string,
    @Req() req,
  ) {
    // Валидируем ObjectId
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid dialog ID format');
    }

    if (!text || text.trim().length === 0) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const userId = req.user._id;
    const message = await this.dialogService.sendMessage(
      id,
      userId,
      text.trim(),
    );

    return ResponseHelper.success(message, 'Message sent successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createDialog(@Body('matchId') matchId: string) {
    // Валидируем ObjectId
    if (!Types.ObjectId.isValid(matchId)) {
      throw new BadRequestException('Invalid dialog ID format');
    }
    const dialog = await this.dialogService.createDialog(matchId);

    return ResponseHelper.success(dialog, 'Message sent successfully');
  }
}
