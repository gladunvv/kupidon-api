import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max, IsNumber } from 'class-validator';
import { PaginationQueryDto } from '../../core/dto/pagination-query.dto';

export class GetNearbyUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 55.7558 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 37.6173 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxDistance?: number;
}
