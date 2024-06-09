import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DialogDocument,
  MatchDocument,
  LikeDocument,
  Like,
  Match,
  Dialog,
} from '../../schemas/';

@Injectable()
export class MatchService {
  constructor(
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(Dialog.name)
    private readonly dialogModel: Model<DialogDocument>,
  ) {}

  async likeUser(userId: string, likedUserId: string) {
    const existingLike = await this.likeModel.findOne({ userId, likedUserId });
    if (existingLike) {
      return;
    }

    const like = new this.likeModel({ userId, likedUserId });
    await like.save();

    const reciprocalLike = await this.likeModel.findOne({
      userId: likedUserId,
      likedUserId: userId,
    });

    if (reciprocalLike) {
      const match = new this.matchModel({ user1: userId, user2: likedUserId });
      await match.save();

      const dialog = new this.dialogModel({ matchId: match._id, messages: [] });
      await dialog.save();

      return { match, dialog };
    }

    return null;
  }
}
