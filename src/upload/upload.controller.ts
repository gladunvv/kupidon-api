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
import { ResponseHelper, ERROR_CODES } from '../core/utils/response.helper';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('photos')
  @UseInterceptors(FilesInterceptor('photos[]', 5)) // Максимум 5 файлов за раз
  async uploadPhotos(
    @UploadedFiles() photos: Express.Multer.File[],
    @Req() req: Request,
  ) {
    if (!photos || photos.length === 0) {
      throw new BadRequestException(
        ResponseHelper.error(
          'No photos provided',
          ERROR_CODES.BAD_REQUEST,
        ).message,
      );
    }

    const userId = req.user._id;
    return await this.uploadService.uploadPhotos(userId, photos);
  }

  @Delete('photo')
  async deletePhoto(@Req() req: Request, @Body('photoPath') photoPath: string) {
    if (!photoPath) {
      throw new BadRequestException(
        ResponseHelper.error(
          'Photo path is required',
          ERROR_CODES.BAD_REQUEST,
        ).message,
      );
    }

    const userId = req.user._id;
    return await this.uploadService.deletePhoto(userId, photoPath);
  }

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

  @Get('photos')
  async getUserPhotos(@Req() req: Request) {
    const userId = req.user._id;
    return await this.uploadService.getUserPhotos(userId);
  }
}
