import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LikeDocument = Like & Document;

@Schema({
  collection: 'likes',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Like {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  likedUserId: Types.ObjectId;
}

export const LikeSchema = SchemaFactory.createForClass(Like);

LikeSchema.index(
  { userId: 1, likedUserId: 1 },
  { unique: true, name: 'uniq_like_direction' },
);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Like.name,
        schema: LikeSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class LikeMongoModule {}
