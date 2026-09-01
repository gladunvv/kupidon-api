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
          $project: {
            _id: 1,
            matchId: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
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

  // Cursor pagination (keyset, by _id) rather than skip/limit: a page is
  // defined by "before this message id", not by a numeric offset, so
  // messages sent concurrently while a client is paging never shift
  // already-fetched pages — no gaps, no duplicates.
  async getMessages(
    dialogId: string,
    userId: string,
    options: { limit: number; before?: string },
  ) {
    const userObjectId = new Types.ObjectId(userId);
    const dialogObjectId = new Types.ObjectId(dialogId);

    const dialog = await this.dialogModel.findOne({
      _id: dialogObjectId,
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
      isActive: true,
    });
    if (!dialog) {
      throw new NotFoundException('Dialog not found or access denied');
    }

    const filter: Record<string, unknown> = { dialogId: dialogObjectId };
    if (options.before) {
      filter._id = { $lt: new Types.ObjectId(options.before) };
    }

    // Fetch one extra to learn whether another page exists without a
    // separate count query.
    const rows = await this.messageModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(options.limit + 1)
      .populate('sender', 'name')
      .exec();

    const hasMore = rows.length > options.limit;
    const page = rows.slice(0, options.limit);
    const nextCursor = hasMore ? page[page.length - 1]._id.toString() : null;

    const messages = page.reverse().map((message) => {
      const sender = message.sender as unknown as {
        _id: Types.ObjectId;
        name: string;
      };

      return {
        _id: message._id,
        text: this.encryptionService.decrypt({
          ciphertext: message.ciphertext,
          iv: message.iv,
          authTag: message.authTag,
          keyVersion: message.keyVersion,
        }),
        sender,
        isFromCurrentUser: sender._id.equals(userObjectId),
        created_at: message.created_at,
      };
    });

    return { messages, pagination: { hasMore, nextCursor } };
  }

  async sendMessage(dialogId: string, senderId: string, text: string) {
    const dialogObjectId = new Types.ObjectId(dialogId);
    const senderObjectId = new Types.ObjectId(senderId);
    const dialog = await this.dialogModel.findOne({
      _id: dialogObjectId,
      $or: [{ user1: senderObjectId }, { user2: senderObjectId }],
      isActive: true,
    });
    if (!dialog) {
      throw new NotFoundException('Dialog not found or access denied');
    }

    const encryptedText = this.encryptionService.encrypt(text);

    const message = new this.messageModel({
      dialogId: dialogObjectId,
      sender: senderObjectId,
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

  async createDialog(matchId: string, userId: string) {
    const matchObjectId = new Types.ObjectId(matchId);
    const userObjectId = new Types.ObjectId(userId);
    const match = await this.matchModel.findOne({
      _id: matchObjectId,
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
    });
    if (!match) {
      throw new NotFoundException('Match not found or access denied');
    }

    return this.dialogModel.findOneAndUpdate(
      { matchId: matchObjectId },
      {
        $setOnInsert: {
          matchId: matchObjectId,
          user1: match.user1,
          user2: match.user2,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
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
