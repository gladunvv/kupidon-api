import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Like, LikeDocument } from '../match/schemas/like.schema';
import { Match, MatchDocument } from '../match/schemas/match.schema';
import { Dialog, DialogDocument } from '../dialog/schemas/dialog.schema';
import { Message, MessageDocument } from '../dialog/schemas/message.schema';
import { BlockService } from '../block/block.service';
import { StorageService } from '../storage/storage.service';
import { ERROR_CODES } from '../core/http/error-codes';
import { paginate, Paginated } from '../core/http/paginated';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  UpdateProfileDto,
  UpdateSearchPreferencesDto,
} from './dto/update-profile.dto';

const REQUIRED_PROFILE_FIELDS = [
  'name',
  'age',
  'gender',
  'about',
  'city',
] as const;

const OPTIONAL_PROFILE_FIELDS = [
  'interests',
  'goals',
  'lifestyleOptions',
  'occupation',
  'education',
  'height',
] as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(Dialog.name) private dialogModel: Model<DialogDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    private readonly blockService: BlockService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findUsersForMatching(
    currentUserId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<Paginated<User>> {
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      return paginate([], page, limit, 0);
    }

    const currentUserObjectId = new Types.ObjectId(currentUserId);

    const [likedUserIds, matches, blockedUserIds] = await Promise.all([
      this.likeModel
        .find({ userId: currentUserObjectId })
        .distinct('likedUserId')
        .exec(),
      this.matchModel
        .find({
          $or: [{ user1: currentUserObjectId }, { user2: currentUserObjectId }],
        })
        .exec(),
      this.blockService.getBlockedCounterpartIds(currentUserObjectId),
    ]);

    const matchedUserIds = matches.map((match) =>
      match.user1.equals(currentUserObjectId) ? match.user2 : match.user1,
    );

    const excludedUserIds = [
      currentUserObjectId,
      ...likedUserIds,
      ...matchedUserIds,
      ...blockedUserIds,
    ];

    const { minAge, maxAge, genders, maxDistance } =
      currentUser.searchPreferences ?? {};

    const matchFilter: Record<string, unknown> = {
      _id: { $nin: excludedUserIds },
      isActive: true,
    };

    if (genders && genders.length > 0) {
      matchFilter.gender = { $in: genders };
    } else if (currentUser.gender === 'male') {
      matchFilter.gender = 'female';
    } else if (currentUser.gender === 'female') {
      matchFilter.gender = 'male';
    }

    if (typeof minAge === 'number' || typeof maxAge === 'number') {
      matchFilter.age = {
        ...(typeof minAge === 'number' ? { $gte: minAge } : {}),
        ...(typeof maxAge === 'number' ? { $lte: maxAge } : {}),
      };
    }

    const searchCoordinates =
      currentUser.coordinates && currentUser.coordinates.length >= 2
        ? ([currentUser.coordinates[0], currentUser.coordinates[1]] as [
            number,
            number,
          ])
        : undefined;

    const pipeline: PipelineStage[] = searchCoordinates
      ? [
          {
            $geoNear: {
              near: { type: 'Point' as const, coordinates: searchCoordinates },
              distanceField: 'distance',
              maxDistance: (maxDistance ?? 50) * 1000,
              spherical: true,
              query: matchFilter,
            },
          },
        ]
      : [{ $match: matchFilter }, { $sort: { _id: -1 as const } }];

    pipeline.push(
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interests',
        },
      },
      {
        $addFields: {
          interests: {
            $map: {
              input: '$interests',
              as: 'interest',
              in: '$$interest.label',
            },
          },
        },
      },
      {
        $project: {
          phone: 0,
          __v: 0,
          created_at: 0,
          updated_at: 0,
        },
      },
      {
        $facet: {
          users: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    );

    const [result] = await this.userModel.aggregate(pipeline).exec();

    const users = result.users || [];
    const total = result.totalCount[0]?.count || 0;

    return paginate(users, page, limit, total);
  }

  async findById(userId: string): Promise<User> {
    return this.userModel.findById(userId).exec();
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const updateData: Record<string, unknown> = { ...updateProfileDto };
    updateData.lastActiveAt = new Date();

    if (updateProfileDto.coordinates) {
      updateData.locationType = 'Point';
    }

    return this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .populate('city', 'name fullName countryCode')
      .populate('interests', 'label value weight icon')
      .populate('goals', 'name weight icon')
      .populate({
        path: 'lifestyleOptions',
        populate: {
          path: 'category',
          select: 'name description',
        },
      })
      .exec();
  }

  async getFullProfile(userId: string): Promise<User> {
    return this.userModel
      .findById(userId)
      .populate('city', 'name fullName countryCode coordinates')
      .populate('interests', 'label value weight icon tags')
      .populate('goals', 'name weight icon tags')
      .populate({
        path: 'lifestyleOptions',
        populate: {
          path: 'category',
          select: 'name description',
        },
      })
      .exec();
  }

  async getCompleteProfile(userId: string) {
    const user = await this.getFullProfile(userId);

    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    const filledRequired = REQUIRED_PROFILE_FIELDS.filter((field) =>
      this.isProfileFieldFilled(user, field),
    ).length;

    const filledOptional = OPTIONAL_PROFILE_FIELDS.filter((field) =>
      this.isProfileFieldFilled(user, field),
    ).length;

    const completeness = Math.round(
      (filledRequired / REQUIRED_PROFILE_FIELDS.length) * 70 +
        (filledOptional / OPTIONAL_PROFILE_FIELDS.length) * 30,
    );

    const userDoc = user as UserDocument;
    const plain =
      typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...user };

    return {
      ...plain,
      profileCompleteness: completeness,
      missingRequiredFields: REQUIRED_PROFILE_FIELDS.filter(
        (field) => !this.isProfileFieldFilled(user, field),
      ),
    };
  }

  private isProfileFieldFilled(user: User, field: string): boolean {
    const value = (user as unknown as Record<string, unknown>)[field];
    if (value == null || value === '') {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return true;
  }

  async updateSearchPreferences(
    userId: string,
    updateSearchPreferencesDto: UpdateSearchPreferencesDto,
  ): Promise<User> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          searchPreferences: updateSearchPreferencesDto,
          lastActiveAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  async findNearbyUsers(
    currentUserId: string,
    coordinates?: { latitude: number; longitude: number },
    maxDistance = 50,
    page = 1,
    limit = 10,
  ): Promise<Paginated<User>> {
    const currentUser = await this.userModel.findById(currentUserId).exec();

    if (!currentUser) {
      throw new NotFoundException({
        message: 'Current user not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    const searchCoordinates: [number, number] | undefined = coordinates
      ? [coordinates.longitude, coordinates.latitude]
      : currentUser.coordinates && currentUser.coordinates.length >= 2
        ? ([currentUser.coordinates[0], currentUser.coordinates[1]] as [
            number,
            number,
          ])
        : undefined;

    if (!searchCoordinates) {
      throw new NotFoundException({
        message: 'No coordinates available for search',
        code: ERROR_CODES.NO_COORDINATES_AVAILABLE,
      });
    }

    const currentUserObjectId = new Types.ObjectId(currentUserId);
    const blockedUserIds =
      await this.blockService.getBlockedCounterpartIds(currentUserObjectId);

    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: {
            type: 'Point' as const,
            coordinates: searchCoordinates,
          },
          distanceField: 'distance',
          maxDistance: maxDistance * 1000,
          spherical: true,
          query: {
            _id: { $ne: currentUserObjectId, $nin: blockedUserIds },
            isActive: true,
            coordinates: { $exists: true },
          },
        },
      },
      {
        $lookup: {
          from: 'cities',
          localField: 'city',
          foreignField: '_id',
          as: 'city',
        },
      },
      {
        $lookup: {
          from: 'interests',
          localField: 'interests',
          foreignField: '_id',
          as: 'interests',
        },
      },
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

    return paginate(users, page, limit, total);
  }

  async calculateCompatibility(userId1: string, userId2: string) {
    const isBlocked = await this.blockService.isBlocked(
      new Types.ObjectId(userId1),
      new Types.ObjectId(userId2),
    );

    if (isBlocked) {
      throw new NotFoundException({
        message: 'One or both users not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    const [user1, user2] = await Promise.all([
      this.getFullProfile(userId1),
      this.getFullProfile(userId2),
    ]);

    if (!user1 || !user2) {
      throw new NotFoundException({
        message: 'One or both users not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    const factors: Array<{ name: string; score: number; details: string }> = [];
    let compatibilityScore = 0;

    const commonInterests = user1.interests.filter((interest1) =>
      user2.interests.some(
        (interest2) => interest1._id.toString() === interest2._id.toString(),
      ),
    );
    const interestScore =
      commonInterests.length > 0
        ? (commonInterests.length /
            Math.max(user1.interests.length, user2.interests.length)) *
          40
        : 0;
    compatibilityScore += interestScore;
    factors.push({
      name: 'Общие интересы',
      score: Math.round(interestScore),
      details: `${commonInterests.length} общих интересов`,
    });

    const commonGoals = user1.goals.filter((goal1) =>
      user2.goals.some(
        (goal2) => goal1._id.toString() === goal2._id.toString(),
      ),
    );
    const goalScore =
      commonGoals.length > 0
        ? (commonGoals.length /
            Math.max(user1.goals.length, user2.goals.length)) *
          30
        : 0;
    compatibilityScore += goalScore;
    factors.push({
      name: 'Общие цели',
      score: Math.round(goalScore),
      details: `${commonGoals.length} общих целей`,
    });

    const ageDiff = Math.abs(user1.age - user2.age);
    const ageScore =
      ageDiff <= 5 ? 20 : ageDiff <= 10 ? 15 : ageDiff <= 15 ? 10 : 5;
    compatibilityScore += ageScore;
    factors.push({
      name: 'Возрастная совместимость',
      score: ageScore,
      details: `Разница в возрасте: ${ageDiff} лет`,
    });

    let locationScore = 0;
    if (user1.coordinates && user2.coordinates) {
      const distance =
        Math.sqrt(
          Math.pow(user1.coordinates[0] - user2.coordinates[0], 2) +
            Math.pow(user1.coordinates[1] - user2.coordinates[1], 2),
        ) * 111;

      locationScore =
        distance <= 10 ? 10 : distance <= 50 ? 7 : distance <= 100 ? 5 : 2;
    }
    compatibilityScore += locationScore;
    factors.push({
      name: 'Географическая близость',
      score: locationScore,
      details:
        user1.city &&
        user2.city &&
        user1.city._id.toString() === user2.city._id.toString()
          ? 'Один город'
          : 'Разные города',
    });

    return {
      totalScore: Math.round(compatibilityScore),
      factors,
      recommendation:
        compatibilityScore >= 70
          ? 'Высокая совместимость'
          : compatibilityScore >= 50
            ? 'Средняя совместимость'
            : compatibilityScore >= 30
              ? 'Низкая совместимость'
              : 'Очень низкая совместимость',
    };
  }

  async deleteAccount(userId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);

    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    const dialogIds = await this.dialogModel
      .find({ $or: [{ user1: userObjectId }, { user2: userObjectId }] })
      .distinct('_id');

    // Reports are kept for moderation history even after the reported or
    // reporting account is gone, so they're deliberately not touched here.
    await Promise.all([
      this.messageModel.deleteMany({ dialogId: { $in: dialogIds } }),
      this.dialogModel.deleteMany({ _id: { $in: dialogIds } }),
      this.matchModel.deleteMany({
        $or: [{ user1: userObjectId }, { user2: userObjectId }],
      }),
      this.likeModel.deleteMany({
        $or: [{ userId: userObjectId }, { likedUserId: userObjectId }],
      }),
      this.blockService.unblockAll(userObjectId),
    ]);

    const photoKeys = await this.storageService.listKeys(`users/${userId}/`);
    if (photoKeys.length > 0) {
      await this.storageService.deleteMany(photoKeys);
    }

    await this.userModel.findByIdAndDelete(userObjectId);
  }
}
