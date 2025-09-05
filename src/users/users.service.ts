import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from 'src/schemas/user.schema';
import { Like, LikeDocument } from 'src/schemas/like.schema';
import { Model, Types } from 'mongoose';
import { UpdateUserProfileDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findUsersForMatching(
    currentUserId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    users: (User & { liked: boolean })[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // Получаем данные текущего пользователя
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      return {
        users: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }

    // Определяем фильтр по полу
    const genderMatchStage: any = {
      _id: { $ne: new Types.ObjectId(currentUserId) }, // Исключаем текущего пользователя
    };

    if (currentUser.gender === 'male') {
      // Если мужчина, показываем женщин
      genderMatchStage.gender = 'female';
    } else if (currentUser.gender === 'female') {
      // Если женщина, показываем мужчин
      genderMatchStage.gender = 'male';
    }
    // Если gender === 'other' или не указан, показываем всех (без дополнительного фильтра)

    // Aggregation pipeline для получения пользователей с информацией о лайках
    const pipeline = [
      // Фильтрация пользователей
      {
        $match: genderMatchStage,
      },

      // Lookup для проверки лайков текущего пользователя
      {
        $lookup: {
          from: 'likes',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', new Types.ObjectId(currentUserId)] },
                    { $eq: ['$likedUserId', '$$userId'] },
                  ],
                },
              },
            },
          ],
          as: 'userLikes',
        },
      },

      // Добавляем поле liked
      {
        $addFields: {
          liked: { $gt: [{ $size: '$userLikes' }, 0] },
        },
      },

      // Исключаем служебные поля и приватную информацию
      {
        $project: {
          phone: 0,
          __v: 0,
          created_at: 0,
          updated_at: 0,
          userLikes: 0,
        },
      },

      // Сортировка по дате создания (новые сначала)
      {
        $sort: { _id: -1 as -1 }, // _id содержит timestamp создания
      },

      // Facet для пагинации и подсчета
      {
        $facet: {
          users: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await this.userModel.aggregate(pipeline).exec();

    const users = result.users || [];
    const total = result.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      users,
      total,
      page,
      totalPages,
    };
  }

  async findById(userId: string): Promise<User> {
    return this.userModel.findById(userId).exec();
  }

  async updateProfile(
    userId: string,
    updateUserProfileDto: UpdateUserProfileDto,
  ): Promise<User> {
    return this.userModel
      .findByIdAndUpdate(userId, updateUserProfileDto, { new: true })
      .exec();
  }
}
