import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ReportService } from './report.service';
import { ReportUserDto } from './dto/report-user.dto';
import { ParseObjectIdPipe } from '../core/pipes/parse-object-id.pipe';
import { ResponseMessage } from '../core/decorators/response-message.decorator';
import { CurrentUser } from '../core/decorators/current-user.decorator';

@ApiTags('Report')
@ApiBearerAuth()
@Controller('users')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @ApiOperation({ summary: 'Report a user' })
  @ApiParam({ name: 'targetUserId', example: '66123456789abcdef0123456' })
  @ResponseMessage('Report submitted successfully')
  @Post(':targetUserId/report')
  async reportUser(
    @CurrentUser('_id') userId: string,
    @Param('targetUserId', ParseObjectIdPipe) targetUserId: string,
    @Body() dto: ReportUserDto,
  ) {
    return this.reportService.report(
      userId,
      targetUserId,
      dto.reason,
      dto.details,
    );
  }
}
