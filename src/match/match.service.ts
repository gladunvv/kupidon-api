import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  addPartnerId,
  lookupPartnerUser,
  matchesForUserMatch,
} from '../core/mongo/partner-aggregation';
import { Like, LikeDocument } from './schemas/like.schema';
import { Match, MatchDocument } from './schemas/match.schema';
import { Dialog, DialogDocument } from '../dialog/schemas/dialog.schema';
import { Message, MessageDocument } from '../dialog/schemas/message.schema';

const PARTNER_FIELDS = { name: 1, age: 1, photos: 1, about: 1 };

@Injectable()
export class MatchService {
  constructor(
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Dialog.name)
    private readonly dialogModel: Model<DialogDocument>,
  ) {}

  async likeUser(userId: string, likedUserId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const likedUserObjectId = new Types.ObjectId(likedUserId);

    const existingLike = await this.likeModel.findOne({
      userId: userObjectId,
      likedUserId: likedUserObjectId,
    });

    if (existingLike) {
      return null;
    }

    const like = new this.likeModel({
      userId: userObjectId,
      likedUserId: likedUserObjectId,
    });
    await like.save();

    const reciprocalLike = await this.likeModel.findOne({
      userId: likedUserObjectId,
      likedUserId: userObjectId,
    });

    if (!reciprocalLike) {
      return null;
    }

    return this.ensureMatchWithDialog(userObjectId, likedUserObjectId);
  }

  private async ensureMatchWithDialog(
    userObjectId: Types.ObjectId,
    otherUserId: Types.ObjectId,
  ) {
    const existingMatch = await this.matchModel.findOne({
      $or: [
        { user1: userObjectId, user2: otherUserId },
        { user1: otherUserId, user2: userObjectId },
      ],
    });

    if (existingMatch) {
      const existingDialog = await this.dialogModel.findOne({
        matchId: existingMatch._id,
      });
      return { match: existingMatch, dialog: existingDialog };
    }

    const match = new this.matchModel({
      user1: userObjectId,
      user2: otherUserId,
    });
    await match.save();

    const dialog = new this.dialogModel({
      matchId: match._id,
      messages: [],
      user1: userObjectId,
      user2: otherUserId,
      isActive: true,
    });
    await dialog.save();

    return { match, dialog };
  }

  async getUserMatches(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    return this.matchModel
      .aggregate([
        matchesForUserMatch(userObjectId),
        addPartnerId(userObjectId),
        lookupPartnerUser(PARTNER_FIELDS),
        {
          $lookup: {
            from: 'dialogs',
            localField: '_id',
            foreignField: 'matchId',
            as: 'dialog',
            pipeline: [
              {
                $lookup: {
                  from: 'messages',
                  localField: 'lastMessage',
                  foreignField: '_id',
                  as: 'lastMessagesData',
                  pipeline: [
                    {
                      $project: {
                        text: 1,
                        sender: 1,
                        created_at: 1,
                      },
                    },
                  ],
                },
              },
              {
                $project: {
                  messagesCount: { $size: '$messages' },
                  lastMessagesData: {
                    $arrayElemAt: ['$lastMessagesData', 0],
                  },
                },
              },
              {
                $project: {
                  user1: 0,
                  user2: 0,
                  created_at: 0,
                  lastMessage: 0,
                  messages: 0,
                  __v: 0,
                },
              },
            ],
          },
        },
        {
          $project: {
            _id: 1,
            created_at: 1,
            partner: { $arrayElemAt: ['$partner', 0] },
            dialog: { $arrayElemAt: ['$dialog', 0] },
            hasDialog: { $gt: [{ $size: '$dialog' }, 0] },
          },
        },
        { $sort: { created_at: -1 } },
      ])
      .exec();
  }

  async getMatchDetails(matchId: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const matchObjectId = new Types.ObjectId(matchId);

    const match = await this.matchModel
      .findOne({
        _id: matchObjectId,
        $or: [{ user1: userObjectId }, { user2: userObjectId }],
      })
      .populate({
        path: 'user1 user2',
        select: 'name age photos about -_id',
      })
      .exec();

    if (!match) {
      throw new NotFoundException('Match not found or access denied');
    }

    const partner = this.partnerFromMatch(match, userObjectId);

    const dialog = await this.dialogModel
      .findOne({ matchId: matchObjectId })
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name',
        },
      })
      .exec();

    if (!dialog) {
      return {
        match: {
          _id: match._id,
          created_at: match.created_at,
        },
        partner,
        dialog: null,
      };
    }

    const hasMessages = await this.messageModel.exists({
      dialogId: dialog._id,
    });

    return {
      match: {
        _id: match._id,
        created_at: match.created_at,
      },
      partner,
      dialog: dialog
        ? {
            _id: dialog._id,
            hasMessages: Boolean(hasMessages),
            lastMessage: dialog.lastMessage,
            isActive: dialog.isActive,
          }
        : null,
    };
  }

  private partnerFromMatch(
    match: MatchDocument,
    currentUserId: Types.ObjectId,
  ) {
    const id = (ref: Types.ObjectId | { _id: Types.ObjectId }) =>
      ref instanceof Types.ObjectId ? ref : ref._id;

    return id(match.user1).equals(currentUserId) ? match.user2 : match.user1;
  }
}
