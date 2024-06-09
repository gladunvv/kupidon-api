import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { MatchService } from './match.service';
import { JwtAuthGuard } from '../auth/guards/auth-guard';

@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @UseGuards(JwtAuthGuard)
  @Post('like')
  async likeUser(@Body('likedUserId') likedUserId: string, @Req() req) {
    const userId = req.user._id;
    const result = await this.matchService.likeUser(userId, likedUserId);
    return result ? { success: true, ...result } : { success: true };
  }
}
