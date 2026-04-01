import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  UpdateSearchPreferencesDto,
} from './dto/update-profile.dto';
import { Request } from 'express';
import { ResponseHelper } from '../core/utils/response.helper';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@Req() req: Request) {
    const userId = req.user._id;
    const user = await this.usersService.getFullProfile(userId);
    return ResponseHelper.success(user, 'Profile retrieved successfully');
  }

  @Get('profile/complete')
  async getCompleteProfile(@Req() req: Request) {
    const userId = req.user._id;
    const profile = await this.usersService.getCompleteProfile(userId);
    return ResponseHelper.success(
      profile,
      'Complete profile retrieved successfully',
    );
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
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user._id;
    const updatedUser = await this.usersService.updateProfile(
      userId,
      updateProfileDto,
    );
    return ResponseHelper.success(updatedUser, 'Profile updated successfully');
  }

  @Patch('search-preferences')
  async updateSearchPreferences(
    @Req() req: Request,
    @Body() updateSearchPreferencesDto: UpdateSearchPreferencesDto,
  ) {
    const userId = req.user._id;
    const updatedUser = await this.usersService.updateSearchPreferences(
      userId,
      updateSearchPreferencesDto,
    );
    return ResponseHelper.success(
      updatedUser,
      'Search preferences updated successfully',
    );
  }

  @Get('nearby')
  async getNearbyUsers(
    @Req() req: Request,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('maxDistance') maxDistance?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const userId = req.user._id;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const coordinates =
      lat && lng
        ? {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
          }
        : undefined;

    const result = await this.usersService.findNearbyUsers(
      userId,
      coordinates,
      maxDistance ? parseInt(maxDistance, 10) : undefined,
      pageNum,
      limitNum,
    );

    return ResponseHelper.success(
      result,
      'Nearby users retrieved successfully',
    );
  }

  @Get('compatibility/:targetUserId')
  async getCompatibility(
    @Req() req: Request,
    @Param('targetUserId') targetUserId: string,
  ) {
    const userId = req.user._id;
    const compatibility = await this.usersService.calculateCompatibility(
      userId,
      targetUserId,
    );
    return ResponseHelper.success(
      compatibility,
      'Compatibility calculated successfully',
    );
  }
}
