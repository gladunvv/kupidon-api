import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BlockDocument = Block & Document;

@Schema({
  collection: 'blocks',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Block {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  blockerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  blockedId: Types.ObjectId;
}

export const BlockSchema = SchemaFactory.createForClass(Block);

BlockSchema.index(
  { blockerId: 1, blockedId: 1 },
  { unique: true, name: 'uniq_block_direction' },
);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Block.name,
        schema: BlockSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class BlockMongoModule {}
