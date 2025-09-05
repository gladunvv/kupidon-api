import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DialogDocument,
  MatchDocument,
  LikeDocument,
  Like,
  Match,
  Dialog,
} from '../schemas';

@Injectable()
export class MatchService {
  constructor(
    @InjectModel(Like.name) private readonly likeModel: Model<LikeDocument>,
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(Dialog.name)
    private readonly dialogModel: Model<DialogDocument>,
  ) {}

  async likeUser(userId: string, likedUserId: string) {
    try {
      // Преобразуем строки в ObjectId
      const userObjectId = new Types.ObjectId(userId);
      const likedUserObjectId = new Types.ObjectId(likedUserId);

      // Проверяем, существует ли уже лайк
      const existingLike = await this.likeModel.findOne({
        userId: userObjectId,
        likedUserId: likedUserObjectId,
      });

      if (existingLike) {
        // Лайк уже существует, ничего не делаем
        return null;
      }

      // Создаем новый лайк
      const like = new this.likeModel({
        userId: userObjectId,
        likedUserId: likedUserObjectId,
      });
      await like.save();

      // Проверяем взаимный лайк
      const reciprocalLike = await this.likeModel.findOne({
        userId: likedUserObjectId,
        likedUserId: userObjectId,
      });

      if (reciprocalLike) {
        // Есть взаимный лайк - создаем матч и диалог

        // Проверяем, не существует ли уже матч между этими пользователями
        const existingMatch = await this.matchModel.findOne({
          $or: [
            { user1: userObjectId, user2: likedUserObjectId },
            { user1: likedUserObjectId, user2: userObjectId },
          ],
        });

        if (existingMatch) {
          // Матч уже существует
          const existingDialog = await this.dialogModel.findOne({
            matchId: existingMatch._id,
          });
          return { match: existingMatch, dialog: existingDialog };
        }

        // Создаем новый матч
        const match = new this.matchModel({
          user1: userObjectId,
          user2: likedUserObjectId,
        });
        await match.save();

        // Создаем диалог для матча
        const dialog = new this.dialogModel({
          matchId: match._id,
          messages: [],
          user1: userObjectId,
          user2: likedUserObjectId,
          isActive: true,
        });
        await dialog.save();

        return { match, dialog };
      }

      // Обычный лайк без взаимности
      return null;
    } catch (error) {
      throw new BadRequestException(`Failed to process like: ${error.message}`);
    }
  }

  // Получение списка матчей пользователя с информацией о партнерах
  async getUserMatches(userId: string) {
    try {
      const userObjectId = new Types.ObjectId(userId);

      const matches = await this.matchModel
        .aggregate([
          // Фильтруем матчи где участвует пользователь
          {
            $match: {
              $or: [{ user1: userObjectId }, { user2: userObjectId }],
            },
          },
          // Определяем партнера
          {
            $addFields: {
              partnerId: {
                $cond: {
                  if: { $eq: ['$user1', userObjectId] },
                  then: '$user2',
                  else: '$user1',
                },
              },
            },
          },
          // Получаем информацию о партнере
          {
            $lookup: {
              from: 'users',
              localField: 'partnerId',
              foreignField: '_id',
              as: 'partner',
              pipeline: [
                {
                  $project: {
                    name: 1,
                    age: 1,
                    photos: 1,
                    about: 1,
                  },
                },
                {
                  $project: {
                    // Исключаем приватную информацию
                    phone: 0,
                    __v: 0,
                  },
                },
              ],
            },
          },
          // Получаем информацию о диалоге
          {
            $lookup: {
              from: 'dialogs',
              localField: '_id',
              foreignField: 'matchId',
              as: 'dialog',
            },
          },
          // Форматируем результат
          {
            $project: {
              _id: 1,
              created_at: 1,
              partner: { $arrayElemAt: ['$partner', 0] },
              dialog: { $arrayElemAt: ['$dialog', 0] },
              hasDialog: { $gt: [{ $size: '$dialog' }, 0] },
            },
          },
          // Сортируем по дате создания (новые сначала)
          {
            $sort: { created_at: -1 },
          },
        ])
        .exec();

      return matches;
    } catch (error) {
      throw new BadRequestException(`Failed to get matches: ${error.message}`);
    }
  }

  // Получение деталей конкретного матча
  async getMatchDetails(matchId: string, userId: string) {
    try {
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
        throw new BadRequestException('Match not found or access denied');
      }

      // Определяем партнера
      const isUser1 =
        match.user1.equals?.(userObjectId) ?? match.user1.toString() === userId;
      const partner = isUser1 ? match.user2 : match.user1;

      // Получаем диалог
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

      return {
        match: {
          _id: match._id,
          created_at: (match as any).created_at,
        },
        partner,
        dialog: dialog
          ? {
              _id: dialog._id,
              hasMessages: dialog.messages.length > 0,
              lastMessage: dialog.lastMessage,
              isActive: dialog.isActive,
            }
          : null,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to get match details: ${error.message}`,
      );
    }
  }
}
