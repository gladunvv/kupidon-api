import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user.dto';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: Request) {
    const userId = req.user.userId;
    return this.usersService.findById(userId);
  }

  @Get('all')
  async getAllProfiles() {
    return this.usersService.findAll();
  }

  @Put()
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
  ) {
    const userId = req.user.userId;
    return this.usersService.updateProfile(userId, updateUserProfileDto);
  }
}
