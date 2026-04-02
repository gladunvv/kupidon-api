import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Влад' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 28 })
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  age?: number;

  @ApiPropertyOptional({ enum: ['male', 'female'] })
  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @ApiPropertyOptional({ example: 'Люблю путешествия и спорт' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  about?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['/uploads/1.jpg', '/uploads/2.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ example: '66123456789abcdef0123456' })
  @IsOptional()
  @IsMongoId()
  city?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['66123456789abcdef0123456'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  interests?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['66123456789abcdef0123456'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  goals?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['66123456789abcdef0123456'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  lifestyleOptions?: string[];

  @ApiPropertyOptional({ example: 'Backend developer' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiPropertyOptional({ example: 'Высшее' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  education?: string;

  @ApiPropertyOptional({ example: 182 })
  @IsOptional()
  @IsNumber()
  @Min(150)
  @Max(220)
  height?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [37.6173, 55.7558],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: number[];
}

export class UpdateSearchPreferencesDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  minAge?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  maxAge?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxDistance?: number;

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(['male', 'female', 'other'], { each: true })
  genders?: string[];
}
