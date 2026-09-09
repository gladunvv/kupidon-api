import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Block, BlockDocument } from './schemas/block.schema';

@Injectable()
export class BlockService {
  constructor(
    @InjectModel(Block.name) private readonly blockModel: Model<BlockDocument>,
  ) {}

  async block(blockerId: string, blockedId: string): Promise<Block> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const blockerObjectId = new Types.ObjectId(blockerId);
    const blockedObjectId = new Types.ObjectId(blockedId);

    return this.blockModel.findOneAndUpdate(
      { blockerId: blockerObjectId, blockedId: blockedObjectId },
      {
        $setOnInsert: {
          blockerId: blockerObjectId,
          blockedId: blockedObjectId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blockModel.deleteOne({
      blockerId: new Types.ObjectId(blockerId),
      blockedId: new Types.ObjectId(blockedId),
    });
  }

  async isBlocked(
    userIdA: Types.ObjectId,
    userIdB: Types.ObjectId,
  ): Promise<boolean> {
    const exists = await this.blockModel.exists({
      $or: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    });

    return Boolean(exists);
  }

  async unblockAll(userId: Types.ObjectId): Promise<void> {
    await this.blockModel.deleteMany({
      $or: [{ blockerId: userId }, { blockedId: userId }],
    });
  }

  async getBlockedCounterpartIds(
    userId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const blocks = await this.blockModel
      .find({ $or: [{ blockerId: userId }, { blockedId: userId }] })
      .exec();

    return blocks.map((block) =>
      block.blockerId.equals(userId) ? block.blockedId : block.blockerId,
    );
  }
}
