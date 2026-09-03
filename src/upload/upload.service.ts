import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ERROR_CODES } from '../core/http/error-codes';
import { StorageService } from '../storage/storage.service';

const MAX_PHOTOS = 5;

@Injectable()
export class UploadService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly storageService: StorageService,
  ) {}

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

    // Checked before touching storage — unlike the old disk-based flow,
    // there's nothing to clean up if the request is rejected here.
    const totalPhotos = user.photos.length + photos.length;
    if (totalPhotos > MAX_PHOTOS) {
      throw new BadRequestException({
        message: `Maximum 5 photos allowed. You have ${user.photos.length} photos, trying to add ${photos.length}`,
        code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
      });
    }

    const uploadedUrls: string[] = [];
    try {
      for (const photo of photos) {
        const key = `users/${userId}/${uuidv4()}${extname(photo.originalname)}`;
        const url = await this.storageService.upload(
          key,
          photo.buffer,
          photo.mimetype,
        );
        uploadedUrls.push(url);
      }
    } catch (_error) {
      await this.rollbackUploads(uploadedUrls);
      throw new BadRequestException({
        message: 'Failed to upload photos',
        code: ERROR_CODES.PHOTO_UPLOAD_FAILED,
      });
    }

    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $push: { photos: { $each: uploadedUrls } },
      });
    } catch (error) {
      await this.rollbackUploads(uploadedUrls);
      throw error;
    }

    return {
      photos: uploadedUrls,
    };
  }

  private async rollbackUploads(urls: string[]): Promise<void> {
    const keys = urls
      .map((url) => this.storageService.getKeyFromUrl(url))
      .filter((key): key is string => key !== null);

    try {
      await this.storageService.deleteMany(keys);
    } catch {
      // Best effort — a failed rollback leaves an orphan object in storage,
      // which the orphan-photos sweep cleans up later. Never surfaced to
      // the caller, who already gets an error for the failed upload itself.
    }
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

    // DB write first: if storage deletion below fails, the result is an
    // orphan object (cleaned up later), not a broken reference in the
    // user's photo list.
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { photos: photoPath },
    });

    const key = this.storageService.getKeyFromUrl(photoPath);
    if (key) {
      try {
        await this.storageService.delete(key);
      } catch {
        // Игнорируем ошибку — см. комментарий выше.
      }
    }

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
