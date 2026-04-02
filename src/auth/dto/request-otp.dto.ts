import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+79990001122' })
  @IsString()
  @IsPhoneNumber()
  phone: string;
}
