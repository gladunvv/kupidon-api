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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ParseObjectIdPipe } from 'src/core/pipes/parse-object-id.pipe';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetNearbyUsersQueryDto } from './dto/get-nearby-users-query.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @Get()
  async getProfile(@Req() req: Request) {
    const userId = req.user._id;
    const user = await this.usersService.getFullProfile(userId);
    return ResponseHelper.success(user, 'Profile retrieved successfully');
  }

  @ApiOperation({ summary: 'Get profile completeness details' })
  @Get('profile/complete')
  async getCompleteProfile(@Req() req: Request) {
    const userId = req.user._id;
    const profile = await this.usersService.getCompleteProfile(userId);
    return ResponseHelper.success(
      profile,
      'Complete profile retrieved successfully',
    );
  }

  @ApiOperation({ summary: 'Get candidates for matching' })
  @Get('list')
  async getUsersList(@Req() req: Request, @Query() query: GetUsersQueryDto) {
    const currentUserId = req.user._id;

    const result = await this.usersService.findUsersForMatching(
      currentUserId,
      query.page,
      query.limit,
    );

    return ResponseHelper.success(result, 'Users list retrieved successfully');
  }

  @ApiOperation({ summary: 'Update current user profile' })
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

  @ApiOperation({ summary: 'Update search preferences' })
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

  @ApiOperation({ summary: 'Find nearby users' })
  @Get('nearby')
  async getNearbyUsers(
    @Req() req: Request,
    @Query() query: GetNearbyUsersQueryDto,
  ) {
    const userId = req.user._id;

    const coordinates =
      query.lat && query.lng
        ? {
            latitude: query.lat,
            longitude: query.lng,
          }
        : undefined;

    const result = await this.usersService.findNearbyUsers(
      userId,
      coordinates,
      query.maxDistance,
      query.page,
      query.limit,
    );

    return ResponseHelper.success(
      result,
      'Nearby users retrieved successfully',
    );
  }

  @ApiOperation({ summary: 'Calculate compatibility with another user' })
  @ApiParam({
    name: 'targetUserId',
    example: '66123456789abcdef0123456',
  })
  @Get('compatibility/:targetUserId')
  async getCompatibility(
    @Req() req: Request,
    @Param('targetUserId', ParseObjectIdPipe) targetUserId: string,
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
