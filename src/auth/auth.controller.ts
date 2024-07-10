import { Body, Controller, Post, SetMetadata } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @SetMetadata('allowUnauthorizedRequest', true)
  async register(
    @Body() createUserDto: CreateUserDto,
  ): Promise<{ token: string }> {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  @SetMetadata('allowUnauthorizedRequest', true)
  async login(@Body() loginUserDto: LoginUserDto): Promise<{ token: string }> {
    return this.authService.login(loginUserDto);
  }
}
