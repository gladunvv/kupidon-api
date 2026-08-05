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

    await this.likeModel.updateOne(
      { userId: userObjectId, likedUserId: likedUserObjectId },
      {
        $setOnInsert: {
          userId: userObjectId,
          likedUserId: likedUserObjectId,
        },
      },
      { upsert: true },
    );

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
    // Both writes are idempotent and protected by unique indexes. If creating
    // the dialog fails after the match upsert, repeating the like repairs the
    // incomplete pair without creating another match or dialog. This keeps
    // local standalone MongoDB supported without requiring transactions.
    const [user1, user2] = this.canonicalUserPair(userObjectId, otherUserId);
    const match = await this.matchModel.findOneAndUpdate(
      { user1, user2 },
      { $setOnInsert: { user1, user2 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const dialog = await this.dialogModel.findOneAndUpdate(
      { matchId: match._id },
      {
        $setOnInsert: {
          matchId: match._id,
          user1,
          user2,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return { match, dialog };
  }

  private canonicalUserPair(
    firstUserId: Types.ObjectId,
    secondUserId: Types.ObjectId,
  ): [Types.ObjectId, Types.ObjectId] {
    return firstUserId.toString() < secondUserId.toString()
      ? [firstUserId, secondUserId]
      : [secondUserId, firstUserId];
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
                $project: {
                  hasLastMessage: {
                    $ne: [{ $ifNull: ['$lastMessage', null] }, null],
                  },
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
