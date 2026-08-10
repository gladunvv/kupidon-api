import { ObjectId } from 'mongodb';
import { canonicalPair } from './unique-relationships.command';

describe('unique relationship migration', () => {
  it('returns the same canonical pair for both user orders', () => {
    const first = new ObjectId('507f1f77bcf86cd799439011');
    const second = new ObjectId('507f191e810c19729de860ea');

    expect(canonicalPair(first, second)).toEqual(canonicalPair(second, first));
    expect(canonicalPair(first, second)).toEqual([second, first]);
  });
});
