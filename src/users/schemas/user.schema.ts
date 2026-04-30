import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, SchemaTypes } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  collection: 'users',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class User {
  @Prop({ type: String })
  name: string;

  @Prop({ type: Number, min: 18, max: 100 })
  age: number;

  @Prop({ type: String, enum: ['male', 'female', 'other'] })
  gender: string;

  @Prop({ type: String, maxlength: 500 })
  about: string;

  @Prop({ type: String, required: true, unique: true })
  phone: string;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ type: SchemaTypes.ObjectId, ref: 'City' })
  city?: Types.ObjectId;

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: 'Interest' }],
    default: [],
  })
  interests: Types.ObjectId[];

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: 'Goal' }],
    default: [],
  })
  goals: Types.ObjectId[];

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: 'LifestyleOption' }],
    default: [],
  })
  lifestyleOptions: Types.ObjectId[];

  @Prop({ type: String })
  occupation?: string;

  @Prop({ type: String })
  education?: string;

  @Prop({ type: Number, min: 150, max: 220 })
  height?: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Date })
  lastActiveAt?: Date;

  @Prop({
    type: {
      minAge: { type: Number, default: 18 },
      maxAge: { type: Number, default: 50 },
      maxDistance: { type: Number, default: 50 },
      genders: { type: [String], default: [] },
    },
    default: {},
  })
  searchPreferences: {
    minAge: number;
    maxAge: number;
    maxDistance: number;
    genders: string[];
  };

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
  })
  locationType?: 'Point';

  @Prop({
    type: [Number],
    index: '2dsphere',
  })
  coordinates?: number[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ city: 1, isActive: 1 });
UserSchema.index({ age: 1, gender: 1, isActive: 1 });
UserSchema.index({ lastActiveAt: -1 });

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class UserMongoModule {}
