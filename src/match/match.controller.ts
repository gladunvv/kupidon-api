import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  Get,
  Param,
} from '@nestjs/common';
import { MatchService } from './match.service';
import { JwtAuthGuard } from '../auth/guards/auth-guard';
import { ResponseHelper } from '../core/utils/response.helper';
import { assertObjectId } from '../core/utils/mongo-id.util';

@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @UseGuards(JwtAuthGuard)
  @Post('like')
  async likeUser(@Body('likedUserId') likedUserId: string, @Req() req) {
    assertObjectId(likedUserId, 'Invalid user ID format');

    const userId = req.user._id;

    if (userId === likedUserId) {
      throw new BadRequestException('Cannot like yourself');
    }

    const result = await this.matchService.likeUser(userId, likedUserId);

    if (result) {
      return ResponseHelper.success(
        {
          match: result.match,
          dialog: result.dialog,
          matched: true,
        },
        'Match created! You can start chatting now.',
      );
    }

    return ResponseHelper.success({ matched: false }, 'Like sent successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getUserMatches(@Req() req) {
    const userId = req.user._id;
    const matches = await this.matchService.getUserMatches(userId);

    return ResponseHelper.success(matches, 'Matches retrieved successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':matchId')
  async getMatchDetails(@Param('matchId') matchId: string, @Req() req) {
    assertObjectId(matchId, 'Invalid match ID format');

    const userId = req.user._id;
    const matchDetails = await this.matchService.getMatchDetails(
      matchId,
      userId,
    );

    return ResponseHelper.success(
      matchDetails,
      'Match details retrieved successfully',
    );
  }
}
