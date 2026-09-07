import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReportService } from './report.service';

describe('ReportService', () => {
  const reporterId = '507f1f77bcf86cd799439011';
  const reportedUserId = '507f191e810c19729de860ea';

  it('rejects reporting yourself', async () => {
    const reportModel = { create: jest.fn() };
    const service = new ReportService(reportModel as never);

    await expect(
      service.report(reporterId, reporterId, 'spam'),
    ).rejects.toThrow(new BadRequestException('Cannot report yourself'));
    expect(reportModel.create).not.toHaveBeenCalled();
  });

  it('stores the report with reason and optional details', async () => {
    const created = { _id: new Types.ObjectId() };
    const reportModel = { create: jest.fn().mockResolvedValue(created) };
    const service = new ReportService(reportModel as never);

    const result = await service.report(
      reporterId,
      reportedUserId,
      'harassment',
      'Kept sending unwanted messages',
    );

    expect(result).toBe(created);
    expect(reportModel.create).toHaveBeenCalledWith({
      reporterId: new Types.ObjectId(reporterId),
      reportedUserId: new Types.ObjectId(reportedUserId),
      reason: 'harassment',
      details: 'Kept sending unwanted messages',
    });
  });
});
