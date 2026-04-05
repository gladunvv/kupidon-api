import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Patch,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  UpdateSearchPreferencesDto,
} from './dto/update-profile.dto';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { GetNearbyUsersQueryDto } from './dto/get-nearby-users-query.dto';
import { ParseObjectIdPipe } from '../core/pipes/parse-object-id.pipe';
import { ResponseMessage } from '../core/decorators/response-message.decorator';
import { CurrentUser } from '../core/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @ResponseMessage('Profile retrieved successfully')
  @Get()
  async getProfile(@CurrentUser('_id') userId: string) {
    return this.usersService.getFullProfile(userId);
  }

  @ApiOperation({ summary: 'Get profile completeness details' })
  @ResponseMessage('Complete profile retrieved successfully')
  @Get('profile/complete')
  async getCompleteProfile(@CurrentUser('_id') userId: string) {
    return this.usersService.getCompleteProfile(userId);
  }

  @ApiOperation({ summary: 'Get candidates for matching' })
  @ResponseMessage('Users list retrieved successfully')
  @Get('list')
  async getUsersList(
    @CurrentUser('_id') currentUserId: string,
    @Query() query: GetUsersQueryDto,
  ) {
    return this.usersService.findUsersForMatching(
      currentUserId,
      query.page,
      query.limit,
    );
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ResponseMessage('Profile updated successfully')
  @Put()
  async updateProfile(
    @CurrentUser('_id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @ApiOperation({ summary: 'Update search preferences' })
  @ResponseMessage('Search preferences updated successfully')
  @Patch('search-preferences')
  async updateSearchPreferences(
    @CurrentUser('_id') userId: string,
    @Body() updateSearchPreferencesDto: UpdateSearchPreferencesDto,
  ) {
    return this.usersService.updateSearchPreferences(
      userId,
      updateSearchPreferencesDto,
    );
  }

  @ApiOperation({ summary: 'Find nearby users' })
  @ResponseMessage('Nearby users retrieved successfully')
  @Get('nearby')
  async getNearbyUsers(
    @CurrentUser('_id') userId: string,
    @Query() query: GetNearbyUsersQueryDto,
  ) {
    const coordinates =
      query.lat && query.lng
        ? {
            latitude: query.lat,
            longitude: query.lng,
          }
        : undefined;

    return await this.usersService.findNearbyUsers(
      userId,
      coordinates,
      query.maxDistance,
      query.page,
      query.limit,
    );
  }

  @ApiOperation({ summary: 'Calculate compatibility with another user' })
  @ApiParam({
    name: 'targetUserId',
    example: '66123456789abcdef0123456',
  })
  @ResponseMessage('Compatibility calculated successfully')
  @Get('compatibility/:targetUserId')
  async getCompatibility(
    @CurrentUser('_id') userId: string,
    @Param('targetUserId', ParseObjectIdPipe) targetUserId: string,
  ) {
    return this.usersService.calculateCompatibility(userId, targetUserId);
  }
}
