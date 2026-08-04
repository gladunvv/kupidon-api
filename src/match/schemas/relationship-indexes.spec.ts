import { DialogSchema } from '../../dialog/schemas/dialog.schema';
import { LikeSchema } from './like.schema';
import { MatchSchema } from './match.schema';

describe('relationship unique indexes', () => {
  it.each([
    [LikeSchema, { userId: 1, likedUserId: 1 }, 'uniq_like_direction'],
    [MatchSchema, { user1: 1, user2: 1 }, 'uniq_match_pair'],
    [DialogSchema, { matchId: 1 }, 'uniq_dialog_match'],
  ])('defines the expected unique index', (schema, fields, name) => {
    expect(schema.indexes()).toEqual(
      expect.arrayContaining([
        [fields, expect.objectContaining({ unique: true, name })],
      ]),
    );
  });
});
