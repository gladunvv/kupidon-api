import { TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { DialogService } from '../../src/dialog/dialog.service';
import { EncryptionService } from '../../src/encryption/encryption.service';
import { Dialog, DialogDocument } from '../../src/dialog/schemas/dialog.schema';
import {
  Message,
  MessageDocument,
} from '../../src/dialog/schemas/message.schema';
import { Match, MatchDocument } from '../../src/match/schemas/match.schema';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import {
  createMongoTestingModule,
  clearCollections,
  closeMongoTestingModule,
} from './support/mongo';
import { integrationConfig } from './support/config';

describe('DialogService message pagination (real MongoDB)', () => {
  let moduleRef: TestingModule;
  let dialogService: DialogService;
  let userModel: Model<UserDocument>;
  let dialogModel: Model<DialogDocument>;
  let messageModel: Model<MessageDocument>;

  beforeAll(async () => {
    moduleRef = await createMongoTestingModule();
    dialogModel = moduleRef.get(getModelToken(Dialog.name));
    messageModel = moduleRef.get<Model<MessageDocument>>(
      getModelToken(Message.name),
    );
    const matchModel = moduleRef.get<Model<MatchDocument>>(
      getModelToken(Match.name),
    );
    userModel = moduleRef.get(getModelToken(User.name));

    const configService = {
      getOrThrow: () => integrationConfig.encryption,
    } as unknown as ConfigService;
    const encryptionService = new EncryptionService(configService);

    dialogService = new DialogService(
      dialogModel,
      messageModel,
      matchModel,
      encryptionService,
    );
  });

  afterEach(async () => {
    await clearCollections(moduleRef);
  });

  afterAll(async () => {
    await closeMongoTestingModule(moduleRef);
  });

  it('walks every message exactly once, in stable order, after concurrent sends', async () => {
    const userA = await userModel.create({ phone: '+79990006001', name: 'A' });
    const userB = await userModel.create({ phone: '+79990006002', name: 'B' });
    const dialog = await dialogModel.create({
      matchId: new Types.ObjectId(),
      user1: userA._id,
      user2: userB._id,
      isActive: true,
    });

    const messageCount = 25;
    const expectedTexts = Array.from(
      { length: messageCount },
      (_, i) => `message-${i}`,
    );

    await Promise.all(
      expectedTexts.map((text, i) =>
        dialogService.sendMessage(
          dialog._id.toString(),
          (i % 2 === 0 ? userA._id : userB._id).toString(),
          text,
        ),
      ),
    );

    await expect(
      messageModel.countDocuments({ dialogId: dialog._id }),
    ).resolves.toBe(messageCount);

    // Walk every page via the cursor, newest page first, until exhausted.
    const pageLimit = 7;
    const collectedIds: string[] = [];
    const collectedTexts: string[] = [];
    let cursor: string | undefined;
    let safety = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await dialogService.getMessages(
        dialog._id.toString(),
        userA._id.toString(),
        { limit: pageLimit, before: cursor },
      );

      // Each page is oldest -> newest internally; walking newest-page-first
      // and prepending keeps the full collection in chronological order.
      collectedIds.unshift(...page.messages.map((m) => m._id.toString()));
      collectedTexts.unshift(...page.messages.map((m) => m.text));

      if (!page.pagination.hasMore) break;
      cursor = page.pagination.nextCursor!;

      safety += 1;
      expect(safety).toBeLessThan(20); // guard against an infinite loop on a bug
    }

    expect(collectedIds).toHaveLength(messageCount);
    expect(new Set(collectedIds).size).toBe(messageCount);
    expect(new Set(collectedTexts)).toEqual(new Set(expectedTexts));

    const sortedAscending = [...collectedIds].sort();
    expect(collectedIds).toEqual(sortedAscending);
  });

  it('rejects a user who is not a participant in the dialog', async () => {
    const userA = await userModel.create({ phone: '+79990006003', name: 'A' });
    const userB = await userModel.create({ phone: '+79990006004', name: 'B' });
    const outsider = await userModel.create({
      phone: '+79990006005',
      name: 'Outsider',
    });
    const dialog = await dialogModel.create({
      matchId: new Types.ObjectId(),
      user1: userA._id,
      user2: userB._id,
      isActive: true,
    });

    await expect(
      dialogService.getMessages(
        dialog._id.toString(),
        outsider._id.toString(),
        {
          limit: 10,
        },
      ),
    ).rejects.toMatchObject({ message: 'Dialog not found or access denied' });
  });
});
