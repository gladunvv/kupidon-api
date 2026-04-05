import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Get,
  Param,
} from '@nestjs/common';
import { MatchService } from './match.service';
import { JwtAuthGuard } from '../auth/guards/auth-guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LikeUserDto } from './dto/like-user.dto';
import { ParseObjectIdPipe } from '../core/pipes/parse-object-id.pipe';
import { ResponseMessage } from '../core/decorators/response-message.decorator';
import { CurrentUser } from '../core/decorators/current-user.decorator';

@ApiTags('Match')
@ApiBearerAuth()
@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Like another user' })
  @ResponseMessage('Like sent successfully')
  @Post('like')
  async likeUser(@Body() dto: LikeUserDto, @CurrentUser('_id') userId: string) {
    if (userId === dto.likedUserId) {
      throw new BadRequestException('Cannot like yourself');
    }

    const result = await this.matchService.likeUser(userId, dto.likedUserId);

    if (result) {
      return {
        match: result.match,
        dialog: result.dialog,
        matched: true,
      };
    }

    return { matched: false };
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user matches' })
  @ResponseMessage('Matches retrieved successfully')
  @Get()
  async getUserMatches(@CurrentUser('_id') userId: string) {
    return this.matchService.getUserMatches(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get match details' })
  @ApiParam({ name: 'matchId', example: '66123456789abcdef0123456' })
  @ResponseMessage('Match details retrieved successfully')
  @Get(':matchId')
  async getMatchDetails(
    @Param('matchId', ParseObjectIdPipe) matchId: string,
    @CurrentUser('_id') userId: string,
  ) {
    return this.matchService.getMatchDetails(matchId, userId);
  }
}
