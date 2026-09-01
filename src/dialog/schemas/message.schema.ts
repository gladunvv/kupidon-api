import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum StatusMessage {
  SEND = 1,
  REED = 2,
  ERROR = 3,
}

@Schema({
  collection: 'messages',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Dialog', required: true })
  dialogId: Types.ObjectId;

  @Prop({ type: String })
  ciphertext: string;

  @Prop({ type: String })
  iv: string;

  @Prop({ type: String })
  authTag: string;

  @Prop({ type: Number })
  keyVersion: number;

  @Prop({
    type: Number,
    enum: StatusMessage,
    required: true,
    default: StatusMessage.SEND,
  })
  status: StatusMessage;

  created_at: Date;
  updated_at: Date;
}

const MessageSchema = SchemaFactory.createForClass(Message);

// Serves both "all messages in a dialog" and the cursor-paginated query
// (find({dialogId, _id: {$lt: cursor}}).sort({_id: -1})) without an
// in-memory sort.
MessageSchema.index({ dialogId: 1, _id: -1 }, { name: 'dialog_messages_page' });

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Message.name,
        schema: MessageSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class MessageMongoModule {}
