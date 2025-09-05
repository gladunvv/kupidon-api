import { IsString, IsOptional, IsArray, IsNumber, IsIn } from 'class-validator';

export class UpdateUserProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  about?: string;

  @IsArray()
  @IsOptional()
  interests?: string[];

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: string;
}
