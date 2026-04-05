import {
  Controller,
  Post,
  Delete,
  Put,
  Get,
  UploadedFiles,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  @ResponseMessage('Photos uploaded successfully')
  @Post('photos')
  @UseInterceptors(FilesInterceptor('photos', 5))
  async uploadPhotos(
    @UploadedFiles() photos: Express.Multer.File[],
    @CurrentUser('_id') userId: string,
  ) {
    if (!photos?.length) {
      throw new BadRequestException('No photos provided');
    }

    return this.uploadService.uploadPhotos(userId, photos);
  }

  @ApiOperation({ summary: 'Delete one user photo' })
  @ResponseMessage('Photo deleted successfully')
  @Delete('photo')
  async deletePhoto(
    @CurrentUser('_id') userId: string,
    @Body() dto: DeletePhotoDto,
  ) {
    return this.uploadService.deletePhoto(userId, dto.photoPath);
  }

  @ApiOperation({ summary: 'Reorder user photos' })
  @ResponseMessage('Photos reordered successfully')
  @Put('photos/reorder')
  async reorderPhotos(
    @CurrentUser('_id') userId: string,
    @Body() reorderPhotosDto: ReorderPhotosDto,
  ) {
    return this.uploadService.reorderPhotos(
      userId,
      reorderPhotosDto.photoOrder,
    );
  }

  @ApiOperation({ summary: 'Get current user photos' })
  @ResponseMessage('Photos retrieved successfully')
  @Get('photos')
  async getUserPhotos(@CurrentUser('_id') userId: string) {
    return this.uploadService.getUserPhotos(userId);
  }
}
