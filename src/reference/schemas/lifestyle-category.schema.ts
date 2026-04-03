import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LifestyleCategoryDocument = LifestyleCategory & Document;

@Schema({
  collection: 'lifestyle-categories',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class LifestyleCategory {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, default: '' })
  description: string;
}

export const LifestyleCategorySchema =
  SchemaFactory.createForClass(LifestyleCategory);

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: LifestyleCategory.name,
        schema: LifestyleCategorySchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class LifestyleCategoryMongoModule {}
