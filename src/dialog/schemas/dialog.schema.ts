import { Document, Types } from 'mongoose';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';

export type DialogDocument = Dialog & Document;

@Schema({
  collection: 'dialogs',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Dialog {
  @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
  matchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  user2: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Message' })
  lastMessage: Types.ObjectId;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const DialogSchema = SchemaFactory.createForClass(Dialog);

DialogSchema.index({ matchId: 1 }, { unique: true, name: 'uniq_dialog_match' });

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Dialog.name,
        schema: DialogSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class DialogMongoModule {}
