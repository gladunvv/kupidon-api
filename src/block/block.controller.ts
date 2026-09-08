import { Controller, Delete, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BlockService } from './block.service';
import { ParseObjectIdPipe } from '../core/pipes/parse-object-id.pipe';
import { ResponseMessage } from '../core/decorators/response-message.decorator';
import { CurrentUser } from '../core/decorators/current-user.decorator';

@ApiTags('Block')
@ApiBearerAuth()
@Controller('users')
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @ApiOperation({ summary: 'Block a user' })
  @ApiParam({ name: 'targetUserId', example: '66123456789abcdef0123456' })
  @ResponseMessage('User blocked successfully')
  @Post(':targetUserId/block')
  async blockUser(
    @CurrentUser('_id') userId: string,
    @Param('targetUserId', ParseObjectIdPipe) targetUserId: string,
  ) {
    return this.blockService.block(userId, targetUserId);
  }

  @ApiOperation({ summary: 'Unblock a user' })
  @ApiParam({ name: 'targetUserId', example: '66123456789abcdef0123456' })
  @ResponseMessage('User unblocked successfully')
  @Delete(':targetUserId/block')
  async unblockUser(
    @CurrentUser('_id') userId: string,
    @Param('targetUserId', ParseObjectIdPipe) targetUserId: string,
  ) {
    await this.blockService.unblock(userId, targetUserId);
    return { unblocked: true };
  }
}
