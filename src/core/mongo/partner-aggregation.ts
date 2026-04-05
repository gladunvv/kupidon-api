import { PipelineStage, Types } from 'mongoose';

export function activeDialogMatch(
  dialogId: Types.ObjectId,
  userObjectId: Types.ObjectId,
) {
  return {
    $match: {
      _id: dialogId,
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
      isActive: true,
    },
  };
}

export function dialogsForUserMatch(userObjectId: Types.ObjectId) {
  return {
    $match: {
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
      isActive: true,
    },
  };
}

export function matchesForUserMatch(userObjectId: Types.ObjectId) {
  return {
    $match: {
      $or: [{ user1: userObjectId }, { user2: userObjectId }],
    },
  };
}

export function addPartnerId(userObjectId: Types.ObjectId) {
  return {
    $addFields: {
      partnerId: {
        $cond: {
          if: { $eq: ['$user1', userObjectId] },
          then: '$user2',
          else: '$user1',
        },
      },
    },
  };
}

export function lookupPartnerUser(
  projectStage: Record<string, unknown>,
): PipelineStage {
  return {
    $lookup: {
      from: 'users',
      localField: 'partnerId',
      foreignField: '_id',
      as: 'partner',
      pipeline: [{ $project: projectStage }],
    },
  };
}
