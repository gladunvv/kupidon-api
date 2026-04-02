import {
  Controller,
  Post,
  Delete,
  Put,
  Get,
  UploadedFiles,
  UseInterceptors,
  Req,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { UploadService } from './upload.service';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UploadPhotosDto } from './dto/upload-photos.dto';
import { DeletePhotoDto } from './dto/delete-photos.dto';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload up to 5 photos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadPhotosDto })
  @Post('photos')
  @UseInterceptors(FilesInterceptor('photos', 5))
  async uploadPhotos(
    @UploadedFiles() photos: Express.Multer.File[],
    @Req() req: Request,
  ) {
    if (!photos?.length) {
      throw new BadRequestException('No photos provided');
    }

    const userId = req.user._id;
    return this.uploadService.uploadPhotos(userId, photos);
  }

  @ApiOperation({ summary: 'Delete one user photo' })
  @Delete('photo')
  async deletePhoto(@Req() req: Request, @Body() dto: DeletePhotoDto) {
    const userId = req.user._id;
    return this.uploadService.deletePhoto(userId, dto.photoPath);
  }

  @ApiOperation({ summary: 'Reorder user photos' })
  @Put('photos/reorder')
  async reorderPhotos(
    @Req() req: Request,
    @Body() reorderPhotosDto: ReorderPhotosDto,
  ) {
    const userId = req.user._id;
    return await this.uploadService.reorderPhotos(
      userId,
      reorderPhotosDto.photoOrder,
    );
  }

  @ApiOperation({ summary: 'Get current user photos' })
  @Get('photos')
  async getUserPhotos(@Req() req: Request) {
    const userId = req.user._id;
    return await this.uploadService.getUserPhotos(userId);
  }
}
