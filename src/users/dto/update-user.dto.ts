import { IsString, IsOptional, IsArray } from 'class-validator';

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

  // Поля для фотографий и т.д.
}
