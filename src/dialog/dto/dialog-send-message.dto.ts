import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, MaxLength, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, how are you?' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Text is required' })
  @MaxLength(1000, { message: 'Text must be less than 1000 characters' })
  text: string;
}
