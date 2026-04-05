import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeletePhotoDto {
  @ApiProperty({ example: '/uploads/1.jpg' })
  @IsString()
  @IsNotEmpty()
  photoPath: string;
}
