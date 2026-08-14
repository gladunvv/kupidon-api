import { NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { UploadService } from './upload.service';
import { ERROR_CODES } from '../core/http/error-codes';

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('UploadService photo invariants', () => {
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    (unlink as jest.Mock).mockClear();
  });

  const makeFile = (filename: string) =>
    ({ filename, path: `/tmp/${filename}` }) as Express.Multer.File;

  describe('uploadPhotos', () => {
    it('rejects upload for a missing user', async () => {
      const userModel = { findById: jest.fn().mockResolvedValue(null) };
      const service = new UploadService(userModel as never);

      await expect(
        service.uploadPhotos(userId, [makeFile('a.jpg')]),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.USER_NOT_FOUND }),
      });
    });

    it('rejects an upload that would exceed 5 photos and cleans up the uploaded files', async () => {
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: ['p1', 'p2', 'p3', 'p4'] }),
        findByIdAndUpdate: jest.fn(),
      };
      const service = new UploadService(userModel as never);
      const files = [makeFile('a.jpg'), makeFile('b.jpg')];

      await expect(service.uploadPhotos(userId, files)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
        }),
      });
      expect(unlink).toHaveBeenCalledWith('/tmp/a.jpg');
      expect(unlink).toHaveBeenCalledWith('/tmp/b.jpg');
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('adds photos and keeps existing ones when within the limit', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: ['p1'] }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const service = new UploadService(userModel as never);
      const files = [makeFile('a.jpg')];

      const result = await service.uploadPhotos(userId, files);

      expect(result).toEqual({ photos: ['uploads/photos/a.jpg'] });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $push: { photos: { $each: ['uploads/photos/a.jpg'] } },
      });
      expect(unlink).not.toHaveBeenCalled();
    });
  });

  describe('deletePhoto', () => {
    it('rejects deletion for a missing user', async () => {
      const userModel = { findById: jest.fn().mockResolvedValue(null) };
      const service = new UploadService(userModel as never);

      await expect(
        service.deletePhoto(userId, 'uploads/photos/a.jpg'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects deletion of a photo the user doesn't own", async () => {
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: ['uploads/photos/mine.jpg'] }),
      };
      const service = new UploadService(userModel as never);

      await expect(
        service.deletePhoto(userId, 'uploads/photos/not-mine.jpg'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.NOT_FOUND }),
      });
      expect(unlink).not.toHaveBeenCalled();
    });

    it('removes an owned photo from disk and from the user document', async () => {
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: ['uploads/photos/mine.jpg'] }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const service = new UploadService(userModel as never);

      await service.deletePhoto(userId, 'uploads/photos/mine.jpg');

      expect(unlink).toHaveBeenCalled();
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $pull: { photos: 'uploads/photos/mine.jpg' },
      });
    });
  });

  describe('reorderPhotos', () => {
    const existingPhotos = ['p1', 'p2', 'p3'];

    it('rejects an order containing a photo the user does not own', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: existingPhotos }),
      };
      const service = new UploadService(userModel as never);

      await expect(
        service.reorderPhotos(userId, ['p1', 'p2', 'foreign']),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.INVALID_PHOTOS }),
      });
    });

    it('rejects an order that omits one of the user photos', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: existingPhotos }),
      };
      const service = new UploadService(userModel as never);

      await expect(
        service.reorderPhotos(userId, ['p1', 'p2']),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: ERROR_CODES.PHOTO_COUNT_MISMATCH,
        }),
      });
    });

    it('persists a valid reordering', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: existingPhotos }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const service = new UploadService(userModel as never);
      const newOrder = ['p3', 'p1', 'p2'];

      const result = await service.reorderPhotos(userId, newOrder);

      expect(result).toEqual({ photos: newOrder });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        photos: newOrder,
      });
    });
  });
});
