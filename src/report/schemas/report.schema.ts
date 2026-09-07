import { Module } from '@nestjs/common';
import { MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const REPORT_REASONS = [
  'spam',
  'inappropriate_content',
  'harassment',
  'fake_profile',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportDocument = Report & Document;

@Schema({
  collection: 'reports',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Report {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reportedUserId: Types.ObjectId;

  @Prop({ type: String, enum: REPORT_REASONS, required: true })
  reason: ReportReason;

  @Prop({ type: String, maxlength: 500 })
  details?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ reportedUserId: 1, created_at: -1 });

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Report.name,
        schema: ReportSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class ReportMongoModule {}
