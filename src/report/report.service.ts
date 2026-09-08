import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportDocument, ReportReason } from './schemas/report.schema';

@Injectable()
export class ReportService {
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
  ) {}

  async report(
    reporterId: string,
    reportedUserId: string,
    reason: ReportReason,
    details?: string,
  ): Promise<Report> {
    if (reporterId === reportedUserId) {
      throw new BadRequestException('Cannot report yourself');
    }

    return this.reportModel.create({
      reporterId: new Types.ObjectId(reporterId),
      reportedUserId: new Types.ObjectId(reportedUserId),
      reason,
      details,
    });
  }
}
