import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Dialog,
  DialogDocument,
  Message,
  MessageDocument,
} from '../../schemas';

@Injectable()
export class DialogService {
  constructor(
    @InjectModel(Dialog.name)
    private readonly dialogModel: Model<DialogDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
  ) {}

  async getDialog(dialogId: string) {
    const dialog = await this.dialogModel
      .findById(dialogId)
      .populate('messages');
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }
    return dialog;
  }

  async sendMessage(dialogId: string, senderId: string, text: string) {
    const dialog = await this.dialogModel.findById(dialogId);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const message = new this.messageModel({ sender: senderId, text });
    await message.save();

    dialog.messages.push(message);
    await dialog.save();

    return message;
  }
}
