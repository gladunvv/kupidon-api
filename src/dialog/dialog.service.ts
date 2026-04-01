import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Dialog,
  DialogDocument,
  Match,
  Message,
  MessageDocument,
  MatchDocument,
  StatusMessage,
} from '../schemas';
import {
  activeDialogMatch,
  addPartnerId,
  dialogsForUserMatch,
  lookupPartnerUser,
} from '../core/mongo/partner-aggregation';

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
            localField: 'messages',
            foreignField: '_id',
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
                  text: 1,
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
            messagesCount: { $size: '$messagesData' },
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

    return dialogs[0];
  }

  async sendMessage(dialogId: string, senderId: string, text: string) {
    const dialog = await this.dialogModel.findById(dialogId);
    if (!dialog) {
      throw new NotFoundException('Dialog not found');
    }

    const message = new this.messageModel({
      sender: new Types.ObjectId(senderId),
      status: StatusMessage.SEND,
      text,
    });
    await message.save();

    await this.dialogModel.findByIdAndUpdate(dialogId, {
      $push: { messages: message._id },
      lastMessage: message._id,
      updated_at: new Date(),
    });

    const populated = await this.messageModel
      .findById(message._id)
      .populate('sender', 'name')
      .exec();

    if (!populated) {
      throw new NotFoundException('Message not found');
    }

    return populated;
  }

  async createDialog(matchId: string) {
    const match = await this.matchModel.findById(matchId);
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    const dialog = new this.dialogModel({
      matchId,
      user1: match.user1,
      user2: match.user2,
      messages: [],
    });

    await dialog.save();

    return dialog;
  }

  async getUserDialogs(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    return this.dialogModel
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
                  text: 1,
                  sender: { _id: '$sender', name: '$senderName' },
                  created_at: 1,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            messagesCount: { $size: '$messages' },
          },
        },
        {
          $project: {
            _id: 1,
            matchId: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
            lastMessage: { $arrayElemAt: ['$lastMessageData', 0] },
            messagesCount: 1,
            updated_at: 1,
            isActive: 1,
          },
        },
        { $sort: { updated_at: -1 } },
      ])
      .exec();
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
