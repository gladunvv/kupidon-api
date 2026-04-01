import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GoalDocument = Goal & Document;

@Schema({
  collection: 'goals',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Goal {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Number, default: 0 })
  weight: number;

  @Prop({ type: String, default: '' })
  icon: string;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const GoalSchema = SchemaFactory.createForClass(Goal);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Goal.name,
        schema: GoalSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class GoalMongoModule {}
