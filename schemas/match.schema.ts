import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchDocument = Match & Document;

@Schema({
  collection: 'match',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Match {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user2: Types.ObjectId;
}

const MatchSchema = SchemaFactory.createForClass(Match);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Match.name,
        schema: MatchSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class MatchMongoModule {}
