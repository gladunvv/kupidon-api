import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetCitiesQueryDto {
  @ApiPropertyOptional({ example: 'RU', description: 'ISO country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Moscow' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 55.7558 })
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: 55.7558 })
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ example: 100, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDistance?: number;
}
