import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LikeDocument = Like & Document;

@Schema({
  collection: 'likes',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Like {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  likedUserId: Types.ObjectId;
}

const LikeSchema = SchemaFactory.createForClass(Like);

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
