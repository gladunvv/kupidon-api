import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LifestyleOptionDocument = LifestyleOption & Document;

@Schema({
  collection: 'lifestyle-options',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class LifestyleOption {
  @Prop({ required: true })
  label: string;

  @Prop({ type: String, default: '' })
  value: string;

  @Prop({ type: Types.ObjectId, ref: 'LifestyleCategory' })
  category: Types.ObjectId;
}

export const LifestyleOptionSchema =
  SchemaFactory.createForClass(LifestyleOption);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: LifestyleOption.name,
        schema: LifestyleOptionSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class LifestyleOptionMongoModule {}
