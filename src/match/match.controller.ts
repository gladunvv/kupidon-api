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
import { Types } from 'mongoose';
import { ResponseHelper } from '../core/utils/response.helper';

@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @UseGuards(JwtAuthGuard)
  @Post('like')
  async likeUser(@Body('likedUserId') likedUserId: string, @Req() req) {
    // Валидируем ObjectId
    if (!Types.ObjectId.isValid(likedUserId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const userId = req.user._id;

    // Проверяем, что пользователь не лайкает сам себя
    if (userId === likedUserId) {
      throw new BadRequestException('Cannot like yourself');
    }

    const result = await this.matchService.likeUser(userId, likedUserId);

    if (result) {
      // Взаимный лайк - создался матч
      return ResponseHelper.success(
        {
          match: result.match,
          dialog: result.dialog,
          matched: true,
        },
        'Match created! You can start chatting now.',
      );
    } else {
      // Обычный лайк
      return ResponseHelper.success(
        { matched: false },
        'Like sent successfully',
      );
    }
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
    // Валидируем ObjectId
    if (!Types.ObjectId.isValid(matchId)) {
      throw new BadRequestException('Invalid match ID format');
    }

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
