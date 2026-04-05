import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ERROR_CODES } from '../core/http/error-codes';

import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class UploadService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async uploadPhotos(
    userId: string,
    photos: Express.Multer.File[],
  ): Promise<{ photos: string[] }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
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

      throw new BadRequestException({
        message: `Maximum 5 photos allowed. You have ${user.photos.length} photos, trying to add ${photos.length}`,
        code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
      });
    }

    // Создаем пути к новым фотографиям
    const newPhotoPaths = photos.map(
      (photo) => `uploads/photos/${photo.filename}`,
    );

    // Добавляем фото к массиву пользователя
    await this.userModel.findByIdAndUpdate(userId, {
      $push: { photos: { $each: newPhotoPaths } },
    });

    return {
      photos: newPhotoPaths,
    };
  }

  async deletePhoto(userId: string, photoPath: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    // Проверяем, принадлежит ли фото пользователю
    if (!user.photos.includes(photoPath)) {
      throw new BadRequestException({
        message: 'Photo not found',
        code: ERROR_CODES.NOT_FOUND,
      });
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

    return null;
  }

  async reorderPhotos(
    userId: string,
    photoOrder: string[],
  ): Promise<{ photos: string[] }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    // Проверяем, что все фото из нового порядка принадлежат пользователю
    const userPhotos = new Set(user.photos);
    const invalidPhotos = photoOrder.filter((photo) => !userPhotos.has(photo));

    if (invalidPhotos.length > 0) {
      throw new BadRequestException({
        message: 'Some photos do not belong to user',
        code: ERROR_CODES.INVALID_PHOTOS,
      });
    }

    // Проверяем, что количество фото совпадает
    if (photoOrder.length !== user.photos.length) {
      throw new BadRequestException({
        message: 'Photo count mismatch',
        code: ERROR_CODES.PHOTO_COUNT_MISMATCH,
      });
    }

    // Обновляем порядок фотографий
    await this.userModel.findByIdAndUpdate(userId, {
      photos: photoOrder,
    });

    return { photos: photoOrder };
  }

  async getUserPhotos(userId: string): Promise<{ photos: string[] }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    return { photos: user.photos };
  }
}
