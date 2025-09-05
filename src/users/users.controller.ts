import { Body, Controller, Get, Put, Req, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto/update-user.dto';
import { Request } from 'express';
import { ResponseHelper } from '../core/utils/response.helper';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: Request) {
    const userId = req.user.userId;
    const user = await this.usersService.findById(userId);
    return ResponseHelper.success(user, 'Profile retrieved successfully');
  }

  @Get('list')
  async getUsersList(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const currentUserId = req.user._id;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const result = await this.usersService.findUsersForMatching(
      currentUserId,
      pageNum,
      limitNum,
    );

    return ResponseHelper.success(result, 'Users list retrieved successfully');
  }

  @Put()
  async updateProfile(
    @Req() req: Request,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
  ) {
    const userId = req.user._id;
    const updatedUser = await this.usersService.updateProfile(
      userId,
      updateUserProfileDto,
    );
    return ResponseHelper.success(updatedUser, 'Profile updated successfully');
  }
}
