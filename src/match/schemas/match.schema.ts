import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MatchDocument = Match & Document;

@Schema({
  collection: 'matches',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Match {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user2: Types.ObjectId;

  created_at: Date;
  updated_at: Date;
}

export const MatchSchema = SchemaFactory.createForClass(Match);

MatchSchema.index(
  { user1: 1, user2: 1 },
  { unique: true, name: 'uniq_match_pair' },
);

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
