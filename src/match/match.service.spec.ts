import { Types } from 'mongoose';
import { MatchService } from './match.service';

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
});
