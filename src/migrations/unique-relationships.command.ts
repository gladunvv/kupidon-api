import 'reflect-metadata';
import { Collection, Db, Document, MongoClient, ObjectId } from 'mongodb';
import configuration from '../config/load-yaml.config';

type DuplicateGroup = {
  _id: unknown;
  ids: ObjectId[];
  count: number;
};

type AuditResult = {
  duplicateLikes: number;
  duplicateMatches: number;
  duplicateDialogs: number;
};

const INDEXES = {
  likes: 'uniq_like_direction',
  matches: 'uniq_match_pair',
  dialogs: 'uniq_dialog_match',
} as const;

export function canonicalPair(
  firstUserId: ObjectId,
  secondUserId: ObjectId,
): [ObjectId, ObjectId] {
  return firstUserId.toHexString() < secondUserId.toHexString()
    ? [firstUserId, secondUserId]
    : [secondUserId, firstUserId];
}

class UniqueRelationshipsMigration {
  private readonly likes: Collection;
  private readonly matches: Collection;
  private readonly dialogs: Collection;
  private readonly messages: Collection;

  constructor(private readonly db: Db) {
    this.likes = db.collection('likes');
    this.matches = db.collection('matches');
    this.dialogs = db.collection('dialogs');
    this.messages = db.collection('messages');
  }

  async audit(): Promise<AuditResult> {
    const [likeGroups, matchGroups, dialogGroups] = await Promise.all([
      this.getLikeDuplicates(),
      this.getMatchDuplicates(),
      this.getDialogDuplicates(),
    ]);

    return {
      duplicateLikes: this.extraDocuments(likeGroups),
      duplicateMatches: this.extraDocuments(matchGroups),
      duplicateDialogs: this.extraDocuments(dialogGroups),
    };
  }

  async apply(): Promise<AuditResult> {
    await this.removeDuplicateLikes();
    await this.mergeDuplicateMatches();
    await this.mergeDuplicateDialogs();

    const remaining = await this.audit();
    if (Object.values(remaining).some((count) => count > 0)) {
      throw new Error(
        `Duplicate cleanup incomplete: ${JSON.stringify(remaining)}`,
      );
    }

    await this.createIndexes();
    return remaining;
  }

  async rollbackIndexes(): Promise<void> {
    await Promise.all([
      this.dropIndexIfExists(this.likes, INDEXES.likes),
      this.dropIndexIfExists(this.matches, INDEXES.matches),
      this.dropIndexIfExists(this.dialogs, INDEXES.dialogs),
    ]);
  }

  private async removeDuplicateLikes(): Promise<void> {
    for (const group of await this.getLikeDuplicates()) {
      const [, ...duplicates] = this.sortedIds(group.ids);
      await this.likes.deleteMany({ _id: { $in: duplicates } });
    }
  }

  private async mergeDuplicateMatches(): Promise<void> {
    for (const group of await this.getMatchDuplicates()) {
      const [survivorMatchId, ...duplicateMatchIds] = this.sortedIds(group.ids);
      const match = await this.matches.findOne({ _id: survivorMatchId });
      if (!match) continue;

      const [user1, user2] = canonicalPair(match.user1, match.user2);
      await this.consolidateDialogs(
        [survivorMatchId, ...duplicateMatchIds],
        survivorMatchId,
        user1,
        user2,
      );
      await this.matches.deleteMany({ _id: { $in: duplicateMatchIds } });
      await this.matches.updateOne(
        { _id: survivorMatchId },
        { $set: { user1, user2 } },
      );
    }
  }

  private async mergeDuplicateDialogs(): Promise<void> {
    for (const group of await this.getDialogDuplicates()) {
      const matchId = group._id as ObjectId;
      const match = await this.matches.findOne({ _id: matchId });
      if (!match) continue;
      const [user1, user2] = canonicalPair(match.user1, match.user2);
      await this.consolidateDialogs([matchId], matchId, user1, user2);
    }
  }

  private async consolidateDialogs(
    matchIds: ObjectId[],
    survivorMatchId: ObjectId,
    user1: ObjectId,
    user2: ObjectId,
  ): Promise<void> {
    const dialogs = await this.dialogs
      .find({ matchId: { $in: matchIds } })
      .sort({ _id: 1 })
      .toArray();
    if (dialogs.length === 0) return;

    const [survivor, ...duplicates] = dialogs;
    const duplicateDialogIds = duplicates.map(({ _id }) => _id as ObjectId);
    if (duplicateDialogIds.length > 0) {
      await this.messages.updateMany(
        { dialogId: { $in: duplicateDialogIds } },
        { $set: { dialogId: survivor._id } },
      );
      await this.dialogs.deleteMany({ _id: { $in: duplicateDialogIds } });
    }

    const lastMessage = await this.messages.findOne(
      { dialogId: survivor._id },
      { sort: { created_at: -1, _id: -1 } },
    );
    const update: Document = {
      $set: {
        matchId: survivorMatchId,
        user1,
        user2,
        isActive: true,
      },
    };
    if (lastMessage) {
      update.$set.lastMessage = lastMessage._id;
    } else {
      update.$unset = { lastMessage: '' };
    }
    await this.dialogs.updateOne({ _id: survivor._id }, update);
  }

  private async createIndexes(): Promise<void> {
    await this.likes.createIndex(
      { userId: 1, likedUserId: 1 },
      { unique: true, name: INDEXES.likes },
    );
    await this.matches.createIndex(
      { user1: 1, user2: 1 },
      { unique: true, name: INDEXES.matches },
    );
    await this.dialogs.createIndex(
      { matchId: 1 },
      { unique: true, name: INDEXES.dialogs },
    );
  }

  private getLikeDuplicates(): Promise<DuplicateGroup[]> {
    return this.duplicateGroups(this.likes, {
      userId: '$userId',
      likedUserId: '$likedUserId',
    });
  }

  private getMatchDuplicates(): Promise<DuplicateGroup[]> {
    const firstComesFirst = {
      $lt: [{ $toString: '$user1' }, { $toString: '$user2' }],
    };
    return this.duplicateGroups(this.matches, {
      user1: { $cond: [firstComesFirst, '$user1', '$user2'] },
      user2: { $cond: [firstComesFirst, '$user2', '$user1'] },
    });
  }

  private getDialogDuplicates(): Promise<DuplicateGroup[]> {
    return this.duplicateGroups(this.dialogs, '$matchId');
  }

  private duplicateGroups(
    collection: Collection,
    groupId: unknown,
  ): Promise<DuplicateGroup[]> {
    return collection
      .aggregate<DuplicateGroup>([
        {
          $group: { _id: groupId, ids: { $push: '$_id' }, count: { $sum: 1 } },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
  }

  private sortedIds(ids: ObjectId[]): ObjectId[] {
    return [...ids].sort((left, right) =>
      left.toHexString().localeCompare(right.toHexString()),
    );
  }

  private extraDocuments(groups: DuplicateGroup[]): number {
    return groups.reduce((total, group) => total + group.count - 1, 0);
  }

  private async dropIndexIfExists(
    collection: Collection,
    indexName: string,
  ): Promise<void> {
    if (await collection.indexExists(indexName)) {
      await collection.dropIndex(indexName);
    }
  }
}

async function run(): Promise<void> {
  const mode = process.argv.includes('--apply')
    ? 'apply'
    : process.argv.includes('--rollback-indexes')
      ? 'rollback'
      : 'audit';
  const config = configuration();
  const client = new MongoClient(config.mongodb.uri);

  try {
    await client.connect();
    const migration = new UniqueRelationshipsMigration(client.db());

    if (mode === 'apply') {
      const result = await migration.apply();
      console.log('Relationship migration completed', result);
    } else if (mode === 'rollback') {
      await migration.rollbackIndexes();
      console.log('Relationship unique indexes removed');
    } else {
      const result = await migration.audit();
      console.log('Relationship duplicate audit', result);
      if (Object.values(result).some((count) => count > 0)) {
        process.exitCode = 2;
      }
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(
      'Relationship migration failed',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
