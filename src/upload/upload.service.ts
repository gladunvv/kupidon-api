import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { ResponseHelper, ERROR_CODES } from '../core/utils/response.helper';
import { ApiResponse } from '../core/types/api-response.interface';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class UploadService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async uploadPhotos(
    userId: string,
    photos: Express.Multer.File[],
  ): Promise<ApiResponse<{ photos: string[] }>> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(
        ResponseHelper.error('User not found', ERROR_CODES.USER_NOT_FOUND)
          .message,
      );
    }

    // Проверяем, не превысит ли загрузка лимит в 5 фотографий
    const totalPhotos = user.photos.length + photos.length;
    if (totalPhotos > 5) {
      // Удаляем загруженные файлы, так как они не будут использоваться
      for (const file of photos) {
        try {
          await unlink(file.path);
        } catch (_error) {
          // Игнорируем ошибку
        }
      }

      throw new BadRequestException(
        ResponseHelper.error(
          `Maximum 5 photos allowed. You have ${user.photos.length} photos, trying to add ${photos.length}`,
          'MAX_PHOTOS_EXCEEDED',
        ).message,
      );
    }

    // Создаем пути к новым фотографиям
    const newPhotoPaths = photos.map(
      (photo) => `uploads/photos/${photo.filename}`,
    );

    // Добавляем фото к массиву пользователя
    await this.userModel.findByIdAndUpdate(userId, {
      $push: { photos: { $each: newPhotoPaths } },
    });

    return ResponseHelper.success(
      { photos: newPhotoPaths },
      `${photos.length} photo(s) uploaded successfully`,
    );
  }

  async deletePhoto(userId: string, photoPath: string): Promise<ApiResponse> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(
        ResponseHelper.error('User not found', ERROR_CODES.USER_NOT_FOUND)
          .message,
      );
    }

    // Проверяем, принадлежит ли фото пользователю
    if (!user.photos.includes(photoPath)) {
      throw new BadRequestException(
        ResponseHelper.error('Photo not found', ERROR_CODES.NOT_FOUND).message,
      );
    }

    // Удаляем файл с диска
    try {
      await unlink(join(process.cwd(), photoPath));
    } catch (_error) {
      // Игнорируем ошибку, если файл не найден
    }

    // Удаляем из базы данных
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { photos: photoPath },
    });

    return ResponseHelper.message('Photo deleted successfully');
  }

  async reorderPhotos(
    userId: string,
    photoOrder: string[],
  ): Promise<ApiResponse<{ photos: string[] }>> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(
        ResponseHelper.error('User not found', ERROR_CODES.USER_NOT_FOUND)
          .message,
      );
    }

    // Проверяем, что все фото из нового порядка принадлежат пользователю
    const userPhotos = new Set(user.photos);
    const invalidPhotos = photoOrder.filter((photo) => !userPhotos.has(photo));

    if (invalidPhotos.length > 0) {
      throw new BadRequestException(
        ResponseHelper.error(
          'Some photos do not belong to user',
          'INVALID_PHOTOS',
          { invalidPhotos },
        ).message,
      );
    }

    // Проверяем, что количество фото совпадает
    if (photoOrder.length !== user.photos.length) {
      throw new BadRequestException(
        ResponseHelper.error('Photo count mismatch', 'PHOTO_COUNT_MISMATCH', {
          expected: user.photos.length,
          received: photoOrder.length,
        }).message,
      );
    }

    // Обновляем порядок фотографий
    await this.userModel.findByIdAndUpdate(userId, {
      photos: photoOrder,
    });

    return ResponseHelper.success(
      { photos: photoOrder },
      'Photos reordered successfully',
    );
  }

  async getUserPhotos(
    userId: string,
  ): Promise<ApiResponse<{ photos: string[] }>> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(
        ResponseHelper.error('User not found', ERROR_CODES.USER_NOT_FOUND)
          .message,
      );
    }

    return ResponseHelper.success(
      { photos: user.photos },
      'Photos retrieved successfully',
    );
  }
}
