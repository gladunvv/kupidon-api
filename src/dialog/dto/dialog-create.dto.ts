import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class CreateDialogDto {
  @ApiProperty({ example: '66123456789abcdef0123456' })
  @IsMongoId()
  matchId: string;
}
