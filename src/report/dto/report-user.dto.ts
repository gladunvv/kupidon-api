import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { REPORT_REASONS, ReportReason } from '../schemas/report.schema';

export class ReportUserDto {
  @ApiProperty({ enum: REPORT_REASONS, example: 'spam' })
  @IsEnum(REPORT_REASONS)
  reason: ReportReason;

  @ApiPropertyOptional({ example: 'Sent me a link to an external website' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
