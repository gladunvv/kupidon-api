import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class LikeUserDto {
  @ApiProperty({ example: '66123456789abcdef0123456' })
  @IsMongoId()
  likedUserId: string;
}
