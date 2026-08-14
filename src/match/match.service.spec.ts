import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { MatchService } from './match.service';

describe('MatchService one-sided like', () => {
  const firstUserId = '507f1f77bcf86cd799439011';
  const secondUserId = '507f191e810c19729de860ea';

  it('records the like but does not create a match or dialog without reciprocity', async () => {
    const likeModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const matchModel = { findOneAndUpdate: jest.fn() };
    const dialogModel = { findOneAndUpdate: jest.fn() };
    const service = new MatchService(
      likeModel as never,
      matchModel as never,
      {} as never,
      dialogModel as never,
    );

    const result = await service.likeUser(firstUserId, secondUserId);

    expect(result).toBeNull();
    expect(likeModel.updateOne).toHaveBeenCalledTimes(1);
    expect(matchModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(dialogModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('MatchService match details access', () => {
  const userId = '507f1f77bcf86cd799439011';
  const matchId = '507f1f77bcf86cd799439012';

  it('does not reveal match details to a user outside the match', async () => {
    const matchModel = {
      findOne: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      }),
    };
    const service = new MatchService(
      {} as never,
      matchModel as never,
      {} as never,
      {} as never,
    );

    await expect(service.getMatchDetails(matchId, userId)).rejects.toThrow(
      new NotFoundException('Match not found or access denied'),
    );
    expect(matchModel.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(matchId),
      $or: [
        { user1: new Types.ObjectId(userId) },
        { user2: new Types.ObjectId(userId) },
      ],
    });
  });
});

describe('MatchService relationship uniqueness', () => {
  const firstUserId = '507f1f77bcf86cd799439011';
  const secondUserId = '507f191e810c19729de860ea';

  it('uses atomic upserts and the same canonical pair in both directions', async () => {
    const match = { _id: new Types.ObjectId() };
    const dialog = { _id: new Types.ObjectId(), matchId: match._id };
    const likeModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    };
    const matchModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(match),
    };
    const dialogModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(dialog),
    };
    const service = new MatchService(
      likeModel as never,
      matchModel as never,
      {} as never,
      dialogModel as never,
    );

    const results = await Promise.all([
      service.likeUser(firstUserId, secondUserId),
      service.likeUser(secondUserId, firstUserId),
    ]);

    expect(results).toEqual([
      { match, dialog },
      { match, dialog },
    ]);
    expect(likeModel.updateOne).toHaveBeenCalledTimes(2);
    expect(matchModel.findOneAndUpdate).toHaveBeenCalledTimes(2);

    const matchFilters = matchModel.findOneAndUpdate.mock.calls.map(
      ([filter]) => ({
        user1: filter.user1.toString(),
        user2: filter.user2.toString(),
      }),
    );
    expect(matchFilters[0]).toEqual(matchFilters[1]);
    expect(matchFilters[0]).toEqual({
      user1: secondUserId,
      user2: firstUserId,
    });
    expect(dialogModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(dialogModel.findOneAndUpdate).toHaveBeenCalledWith(
      { matchId: match._id },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ matchId: match._id }),
      }),
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });

  it('repairs a match left without a dialog after a failed write', async () => {
    const match = { _id: new Types.ObjectId() };
    const dialog = { _id: new Types.ObjectId(), matchId: match._id };
    const likeModel = {
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
      findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    };
    const matchModel = {
      findOneAndUpdate: jest.fn().mockResolvedValue(match),
    };
    const dialogModel = {
      findOneAndUpdate: jest
        .fn()
        .mockRejectedValueOnce(new Error('temporary dialog write failure'))
        .mockResolvedValueOnce(dialog),
    };
    const service = new MatchService(
      likeModel as never,
      matchModel as never,
      {} as never,
      dialogModel as never,
    );

    await expect(service.likeUser(firstUserId, secondUserId)).rejects.toThrow(
      'temporary dialog write failure',
    );
    await expect(service.likeUser(firstUserId, secondUserId)).resolves.toEqual({
      match,
      dialog,
    });

    expect(matchModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(matchModel.findOneAndUpdate.mock.calls[0]).toEqual(
      matchModel.findOneAndUpdate.mock.calls[1],
    );
    expect(dialogModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(dialogModel.findOneAndUpdate.mock.calls[0]).toEqual(
      dialogModel.findOneAndUpdate.mock.calls[1],
    );
  });
});
