// create-user.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsNumber()
  age: number;

  @IsString()
  gender: string;

  @IsString()
  about: string;

  @IsString()
  phone: string;

  interests: string[];
}
