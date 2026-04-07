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

  @Prop({ type: Types.ObjectId, ref: 'Dialog', required: true, index: true })
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
