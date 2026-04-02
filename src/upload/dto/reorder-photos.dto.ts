import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderPhotosDto {
  @ApiProperty({
    type: [String],
    example: ['/uploads/1.jpg', '/uploads/2.jpg'],
  })
  @IsArray()
  @IsString({ each: true })
  photoOrder: string[];
}
