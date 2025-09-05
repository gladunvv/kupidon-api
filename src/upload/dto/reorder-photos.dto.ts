import { IsArray, IsString } from 'class-validator';

export class ReorderPhotosDto {
  @IsArray()
  @IsString({ each: true })
  photoOrder: string[];
}