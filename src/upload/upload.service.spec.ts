import { NotFoundException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { ERROR_CODES } from '../core/http/error-codes';

describe('UploadService photo invariants', () => {
  const userId = '507f1f77bcf86cd799439011';
  const publicUrl = 'http://127.0.0.1:9000/kupidon-photos';

  const makeStorageService = () => ({
    upload: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteMany: jest.fn().mockResolvedValue(undefined),
    getKeyFromUrl: jest.fn((url: string) =>
      url.startsWith(`${publicUrl}/`) ? url.slice(publicUrl.length + 1) : null,
    ),
  });

  const makeFile = (originalname: string) =>
    ({
      originalname,
      buffer: Buffer.from(originalname),
      mimetype: 'image/jpeg',
    }) as Express.Multer.File;

  describe('uploadPhotos', () => {
    it('rejects upload for a missing user', async () => {
      const userModel = { findById: jest.fn().mockResolvedValue(null) };
      const storageService = makeStorageService();
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );

      await expect(
        service.uploadPhotos(userId, [makeFile('a.jpg')]),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.USER_NOT_FOUND }),
      });
      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('rejects an upload that would exceed 5 photos without touching storage', async () => {
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: ['p1', 'p2', 'p3', 'p4'] }),
        findByIdAndUpdate: jest.fn(),
      };
      const storageService = makeStorageService();
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );
      const files = [makeFile('a.jpg'), makeFile('b.jpg')];

      await expect(service.uploadPhotos(userId, files)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: ERROR_CODES.MAX_PHOTOS_EXCEEDED,
        }),
      });
      expect(storageService.upload).not.toHaveBeenCalled();
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('adds photos and keeps existing ones when within the limit', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: ['p1'] }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const storageService = makeStorageService();
      storageService.upload.mockResolvedValueOnce(
        `${publicUrl}/users/${userId}/a.jpg`,
      );
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );
      const files = [makeFile('a.jpg')];

      const result = await service.uploadPhotos(userId, files);

      expect(result).toEqual({
        photos: [`${publicUrl}/users/${userId}/a.jpg`],
      });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $push: { photos: { $each: [`${publicUrl}/users/${userId}/a.jpg`] } },
      });
    });

    it('rolls back already-uploaded objects when a later upload fails', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: [] }),
        findByIdAndUpdate: jest.fn(),
      };
      const storageService = makeStorageService();
      storageService.upload
        .mockResolvedValueOnce(`${publicUrl}/users/${userId}/a.jpg`)
        .mockRejectedValueOnce(new Error('storage unavailable'));
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );
      const files = [makeFile('a.jpg'), makeFile('b.jpg')];

      await expect(service.uploadPhotos(userId, files)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: ERROR_CODES.PHOTO_UPLOAD_FAILED,
        }),
      });
      expect(storageService.deleteMany).toHaveBeenCalledWith([
        `users/${userId}/a.jpg`,
      ]);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('rolls back every uploaded object when the database write fails', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: [] }),
        findByIdAndUpdate: jest.fn().mockRejectedValue(new Error('db down')),
      };
      const storageService = makeStorageService();
      storageService.upload
        .mockResolvedValueOnce(`${publicUrl}/users/${userId}/a.jpg`)
        .mockResolvedValueOnce(`${publicUrl}/users/${userId}/b.jpg`);
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );
      const files = [makeFile('a.jpg'), makeFile('b.jpg')];

      await expect(service.uploadPhotos(userId, files)).rejects.toThrow(
        'db down',
      );
      expect(storageService.deleteMany).toHaveBeenCalledWith([
        `users/${userId}/a.jpg`,
        `users/${userId}/b.jpg`,
      ]);
    });
  });

  describe('deletePhoto', () => {
    it('rejects deletion for a missing user', async () => {
      const userModel = { findById: jest.fn().mockResolvedValue(null) };
      const storageService = makeStorageService();
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );

      await expect(
        service.deletePhoto(userId, `${publicUrl}/a.jpg`),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects deletion of a photo the user doesn't own", async () => {
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: [`${publicUrl}/mine.jpg`] }),
      };
      const storageService = makeStorageService();
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );

      await expect(
        service.deletePhoto(userId, `${publicUrl}/not-mine.jpg`),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: ERROR_CODES.NOT_FOUND }),
      });
      expect(storageService.delete).not.toHaveBeenCalled();
    });

    it('pulls the photo from the DB before best-effort deleting it from storage', async () => {
      const calls: string[] = [];
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: [`${publicUrl}/mine.jpg`] }),
        findByIdAndUpdate: jest.fn().mockImplementation(async () => {
          calls.push('db');
        }),
      };
      const storageService = makeStorageService();
      storageService.delete.mockImplementation(async () => {
        calls.push('storage');
      });
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );

      await service.deletePhoto(userId, `${publicUrl}/mine.jpg`);

      expect(calls).toEqual(['db', 'storage']);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $pull: { photos: `${publicUrl}/mine.jpg` },
      });
      expect(storageService.delete).toHaveBeenCalledWith('mine.jpg');
    });

    it('swallows storage deletion errors, leaving the DB update in place', async () => {
      const userModel = {
        findById: jest
          .fn()
          .mockResolvedValue({ photos: [`${publicUrl}/mine.jpg`] }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const storageService = makeStorageService();
      storageService.delete.mockRejectedValue(new Error('storage down'));
      const service = new UploadService(
        userModel as never,
        storageService as never,
      );

      await expect(
        service.deletePhoto(userId, `${publicUrl}/mine.jpg`),
      ).resolves.toBeNull();
      expect(userModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('reorderPhotos', () => {
    const existingPhotos = ['p1', 'p2', 'p3'];

    it('rejects an order containing a photo the user does not own', async () => {
      const userModel = {
        findById: jest.fn().mockResolvedValue({ photos: existingPhotos }),
      };
      const service = new UploadService(
        userModel as never,
        makeStorageService() as never,
      );

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
      const service = new UploadService(
        userModel as never,
        makeStorageService() as never,
      );

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
      const service = new UploadService(
        userModel as never,
        makeStorageService() as never,
      );
      const newOrder = ['p3', 'p1', 'p2'];

      const result = await service.reorderPhotos(userId, newOrder);

      expect(result).toEqual({ photos: newOrder });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
        photos: newOrder,
      });
    });
  });
});
