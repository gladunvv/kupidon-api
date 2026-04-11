import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  activeDialogMatch,
  addPartnerId,
  dialogsForUserMatch,
  lookupPartnerUser,
} from '../core/mongo/partner-aggregation';
import { Dialog, DialogDocument } from './schemas/dialog.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { Match, MatchDocument } from '../match/schemas/match.schema';
import { StatusMessage } from './schemas/message.schema';
import { EncryptionService } from '../encryption/encryption.service';

const PARTNER_FIELDS_FULL = { name: 1, age: 1, photos: 1, about: 1 };
const PARTNER_FIELDS_LIST = {
  name: 1,
  photos: { $arrayElemAt: ['$photos', 0] },
};

@Injectable()
export class DialogService {
  constructor(
    @InjectModel(Dialog.name)
    private readonly dialogModel: Model<DialogDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Match.name)
    private readonly matchModel: Model<MatchDocument>,
    private readonly encryptionService: EncryptionService,
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

  async getDialogWithPartner(dialogId: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const dialogObjectId = new Types.ObjectId(dialogId);

    const dialogs = await this.dialogModel
      .aggregate([
        activeDialogMatch(dialogObjectId, userObjectId),
        addPartnerId(userObjectId),
        lookupPartnerUser(PARTNER_FIELDS_FULL),
        {
          $lookup: {
            from: 'messages',
            localField: '_id',
            foreignField: 'dialogId',
            as: 'messagesData',
            pipeline: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'sender',
                  foreignField: '_id',
                  as: 'senderData',
                  pipeline: [{ $project: { name: 1 } }],
                },
              },
              {
                $addFields: {
                  senderName: { $arrayElemAt: ['$senderData.name', 0] },
                  isFromCurrentUser: { $eq: ['$sender', userObjectId] },
                },
              },
              {
                $project: {
                  _id: 1,
                  ciphertext: 1,
                  iv: 1,
                  authTag: 1,
                  keyVersion: 1,
                  sender: { _id: '$sender', name: '$senderName' },
                  isFromCurrentUser: 1,
                  created_at: 1,
                },
              },
              { $sort: { created_at: 1 } },
            ],
          },
        },
        {
          $project: {
            _id: 1,
            matchId: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
            messages: '$messagesData',
            isActive: 1,
            created_at: 1,
            updated_at: 1,
          },
        },
      ])
      .exec();

    if (!dialogs.length) {
      throw new NotFoundException('Dialog not found or access denied');
    }

    return {
      ...dialogs[0],
      messages: dialogs[0].messages.map((message) =>
        this.decryptMessage(message),
      ),
    };
  }

  async sendMessage(dialogId: string, senderId: string, text: string) {
    const dialog = await this.dialogModel.findById(dialogId);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const encryptedText = this.encryptionService.encrypt(text);

    const message = new this.messageModel({
      dialogId: new Types.ObjectId(dialogId),
      sender: new Types.ObjectId(senderId),
      status: StatusMessage.SEND,
      ciphertext: encryptedText.ciphertext,
      iv: encryptedText.iv,
      authTag: encryptedText.authTag,
      keyVersion: encryptedText.keyVersion,
    });
    await message.save();

    await this.updateLastMessage(dialogId, message._id.toString());

    const populated = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name')
      .select('-ciphertext -iv -authTag -keyVersion')
      .exec();

    if (!populated) {
      throw new NotFoundException('Message not found');
    }

    return {
      _id: populated._id,
      text,
      sender: populated.sender,
      created_at: populated.created_at,
    };
  }

  async createDialog(matchId: string) {
    const match = await this.matchModel.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    const dialog = new this.dialogModel({
      matchId: new Types.ObjectId(matchId),
      user1: match.user1,
      user2: match.user2,
    });

    await dialog.save();

    return dialog;
  }

  async getUserDialogs(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const dialogs = await this.dialogModel
      .aggregate([
        dialogsForUserMatch(userObjectId),
        addPartnerId(userObjectId),
        lookupPartnerUser(PARTNER_FIELDS_LIST),
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMessageData',
            pipeline: [
              {
                $lookup: {
                  from: 'users',
                  localField: 'sender',
                  foreignField: '_id',
                  as: 'senderData',
                  pipeline: [{ $project: { name: 1 } }],
                },
              },
              {
                $addFields: {
                  senderName: { $arrayElemAt: ['$senderData.name', 0] },
                },
              },
              {
                $project: {
                  ciphertext: 1,
                  iv: 1,
                  authTag: 1,
                  keyVersion: 1,
                  sender: { _id: '$sender', name: '$senderName' },
                  created_at: 1,
                },
              },
            ],
          },
        },
        {
          $project: {
            _id: 1,
            matchId: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
            lastMessage: { $arrayElemAt: ['$lastMessageData', 0] },
            updated_at: 1,
            isActive: 1,
          },
        },
        { $sort: { updated_at: -1 } },
      ])
      .exec();

    return dialogs.map((dialog) => ({
      ...dialog,
      lastMessage: this.decryptMessage(dialog.lastMessage),
    }));
  }

  private decryptMessage(message: any) {
    if (!message) {
      return null;
    }

    return {
      _id: message._id,
      text: this.encryptionService.decrypt({
        ciphertext: message.ciphertext,
        iv: message.iv,
        authTag: message.authTag,
        keyVersion: message.keyVersion,
      }),
      sender: message.sender,
      created_at: message.created_at,
    };
  }

  async updateLastMessage(dialogId: string, messageId: string) {
    await this.dialogModel
      .findByIdAndUpdate(dialogId, {
        lastMessage: new Types.ObjectId(messageId),
        updated_at: new Date(),
      })
      .exec();
  }
}
