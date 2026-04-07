import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CityDocument = City & Document;

@Schema({
  collection: 'cities',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class City {
  @Prop({ type: String, required: true, index: true })
  name: string;

  @Prop({ type: String })
  fullName?: string;

  @Prop({ type: String, required: true, index: true })
  countryCode: string;

  @Prop({ type: String, index: true })
  region?: string;

  @Prop({
    type: String,
    enum: ['Point'],
    default: 'Point',
  })
  locationType: 'Point';

  @Prop({
    type: [Number],
    index: '2dsphere',
    required: true,
  })
  coordinates: number[];

  @Prop({ type: Number, default: 0 })
  population?: number;

  @Prop({ type: Number, default: 0, index: true })
  popularity?: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String })
  timezone?: string;

  @Prop({ type: [String], default: [] })
  aliases?: string[];
}

export const CitySchema = SchemaFactory.createForClass(City);

CitySchema.index({ name: 'text', fullName: 'text', aliases: 'text' });
CitySchema.index({ countryCode: 1, popularity: -1 });

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: City.name,
        schema: CitySchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class CityMongoModule {}
