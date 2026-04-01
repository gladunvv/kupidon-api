import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InterestDocument = Interest & Document;

@Schema({
  collection: 'interests',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Interest {
  @Prop({ required: true })
  label: string;

  @Prop({ type: String, default: '' })
  value: string;

  @Prop({ type: Number, default: 0 })
  weight: number;

  @Prop({ type: String, default: '' })
  icon: string;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const InterestSchema = SchemaFactory.createForClass(Interest);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Interest.name,
        schema: InterestSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class InterestMongoModule {}
