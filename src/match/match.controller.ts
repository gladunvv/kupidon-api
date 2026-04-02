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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LikeUserDto } from './dto/like-user.dto';
import { ParseObjectIdPipe } from 'src/core/pipes/parse-object-id.pipe';
import { ResponseMessage } from 'src/core/decorators/response-message.decorator';

@ApiTags('Match')
@ApiBearerAuth()
@Controller('match')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Like another user' })
  @ResponseMessage('Like sent successfully')
  @Post('like')
  async likeUser(@Body() dto: LikeUserDto, @Req() req) {
    const userId = req.user._id;

    if (userId === dto.likedUserId) {
      throw new BadRequestException('Cannot like yourself');
    }

    const result = await this.matchService.likeUser(userId, dto.likedUserId);

    if (result) {
      return {
        match: result.match,
        dialog: result.dialog,
        matched: true,
        message: 'Match created! You can start chatting now.',
      };
    }

    return { matched: false };
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user matches' })
  @ResponseMessage('Matches retrieved successfully')
  @Get()
  async getUserMatches(@Req() req) {
    const userId = req.user._id;
    return await this.matchService.getUserMatches(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get match details' })
  @ApiParam({ name: 'matchId', example: '66123456789abcdef0123456' })
  @Get(':matchId')
  async getMatchDetails(
    @Param('matchId', ParseObjectIdPipe) matchId: string,
    @Req() req,
  ) {
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
