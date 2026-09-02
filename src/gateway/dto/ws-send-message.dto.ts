import { Transform } from 'class-transformer';
import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class WsSendMessageDto {
  @IsMongoId()
  dialogId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Text is required' })
  @MaxLength(1000, { message: 'Text must be less than 1000 characters' })
  text: string;
}
