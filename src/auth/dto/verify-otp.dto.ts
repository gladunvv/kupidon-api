import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+79990001122' })
  @IsString()
  @IsPhoneNumber()
  phone: string;

  @ApiProperty({ example: '1234' })
  @IsString()
  otp: string;
}
