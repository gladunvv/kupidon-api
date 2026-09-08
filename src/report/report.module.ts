import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ReportMongoModule } from './schemas/report.schema';

@Module({
  imports: [ReportMongoModule],
  providers: [ReportService],
  controllers: [ReportController],
})
export class ReportModule {}
