import { Document, Types } from 'mongoose';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Message } from './message.schema';
import { Module } from '@nestjs/common';

export type DialogDocument = Dialog & Document;

@Schema({
  collection: 'dialog',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Dialog {
  @Prop({ type: Types.ObjectId, ref: 'Match' })
  matchId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Message' })
  messages: Message[];
}

const DialogSchema = SchemaFactory.createForClass(Dialog);

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
