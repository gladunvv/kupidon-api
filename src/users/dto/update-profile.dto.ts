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

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsEnum(['male', 'female'])
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  about?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsMongoId()
  city?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  goals?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  lifestyleOptions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  education?: string;

  @IsOptional()
  @IsNumber()
  @Min(150)
  @Max(220)
  height?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates?: number[];
}

export class UpdateSearchPreferencesDto {
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  maxAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  maxDistance?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(['male', 'female', 'other'], { each: true })
  genders?: string[];
}
