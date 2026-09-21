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
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Bounds an otherwise unlimited array of reference ids; the seeded
// dictionaries are well below this.
const MAX_REFERENCE_SELECTION = 50;

// Photos are not part of this DTO on purpose: they're written only by the
// upload endpoints, which are the only place a stored photo URL comes from
// (see docs/security-review.md, REL-02).
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
  @ArrayMaxSize(MAX_REFERENCE_SELECTION)
  @IsMongoId({ each: true })
  interests?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['66123456789abcdef0123456'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REFERENCE_SELECTION)
  @IsMongoId({ each: true })
  goals?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['66123456789abcdef0123456'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REFERENCE_SELECTION)
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
