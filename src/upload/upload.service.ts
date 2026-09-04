import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ERROR_CODES } from '../core/http/error-codes';
import { StorageService } from '../storage/storage.service';

const MAX_PHOTOS = 5;
const MIN_DIMENSION_PX = 200;
const MAX_DIMENSION_PX = 2048;
const JPEG_QUALITY = 85;
const OUTPUT_CONTENT_TYPE = 'image/jpeg';

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

    // Validated and re-encoded before anything reaches storage: an invalid
    // file rejects the whole request without leaving orphan objects behind.
    const processedPhotos = await Promise.all(
      photos.map((photo) => this.processImage(photo)),
    );

    const uploadedUrls: string[] = [];
    try {
      for (const buffer of processedPhotos) {
        const key = `users/${userId}/${uuidv4()}.jpg`;
        const url = await this.storageService.upload(
          key,
          buffer,
          OUTPUT_CONTENT_TYPE,
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

  private async processImage(file: Express.Multer.File): Promise<Buffer> {
    let width: number | undefined;
    let height: number | undefined;
    try {
      ({ width, height } = await sharp(file.buffer).metadata());
    } catch {
      throw new BadRequestException({
        message: 'File is not a valid image',
        code: ERROR_CODES.INVALID_IMAGE,
      });
    }

    if (!width || !height) {
      throw new BadRequestException({
        message: 'File is not a valid image',
        code: ERROR_CODES.INVALID_IMAGE,
      });
    }

    if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
      throw new BadRequestException({
        message: `Image must be at least ${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px`,
        code: ERROR_CODES.IMAGE_RESOLUTION_TOO_LOW,
      });
    }

    try {
      // .rotate() with no args bakes the EXIF orientation into the pixels
      // before re-encoding strips all metadata (including that same EXIF
      // data) — otherwise a photo taken on its side would render sideways
      // once the orientation hint is gone. Re-encoding to a single format
      // also flattens animated GIFs down to their first frame.
      return await sharp(file.buffer)
        .rotate()
        .resize({
          width: MAX_DIMENSION_PX,
          height: MAX_DIMENSION_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    } catch {
      throw new BadRequestException({
        message: 'File is not a valid image',
        code: ERROR_CODES.INVALID_IMAGE,
      });
    }
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
