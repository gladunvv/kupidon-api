import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  class FakeCommand {
    constructor(public readonly input: unknown) {}
  }
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    HeadBucketCommand: FakeCommand,
    CreateBucketCommand: FakeCommand,
    PutBucketPolicyCommand: FakeCommand,
    PutObjectCommand: FakeCommand,
    DeleteObjectCommand: FakeCommand,
    DeleteObjectsCommand: FakeCommand,
    ListObjectsV2Command: FakeCommand,
  };
});

describe('StorageService', () => {
  const config = {
    endpoint: 'http://127.0.0.1:9000',
    region: 'us-east-1',
    bucket: 'kupidon-photos',
    accessKeyId: 'kupidon',
    secretAccessKey: 'secret',
    publicUrl: 'http://127.0.0.1:9000/kupidon-photos',
  };

  const makeService = () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(config),
    } as unknown as ConfigService;
    return new StorageService(configService);
  };

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  describe('onModuleInit', () => {
    it('creates the bucket when it does not exist yet, then sets a public-read policy', async () => {
      sendMock.mockImplementationOnce(() =>
        Promise.reject(new Error('NotFound')),
      );
      const service = makeService();

      await service.onModuleInit();

      expect(sendMock).toHaveBeenCalledTimes(3);
      expect(sendMock.mock.calls[0][0].input).toEqual({
        Bucket: 'kupidon-photos',
      });
      expect(sendMock.mock.calls[1][0].input).toEqual({
        Bucket: 'kupidon-photos',
      });
      const policyCall = sendMock.mock.calls[2][0].input as {
        Bucket: string;
        Policy: string;
      };
      expect(policyCall.Bucket).toBe('kupidon-photos');
      expect(JSON.parse(policyCall.Policy)).toMatchObject({
        Statement: [expect.objectContaining({ Effect: 'Allow' })],
      });
    });

    it('skips bucket creation when it already exists', async () => {
      const service = makeService();

      await service.onModuleInit();

      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('upload', () => {
    it('uploads the buffer and returns its public URL', async () => {
      const service = makeService();

      const url = await service.upload(
        'users/u1/photo.jpg',
        Buffer.from('data'),
        'image/jpeg',
      );

      expect(url).toBe(
        'http://127.0.0.1:9000/kupidon-photos/users/u1/photo.jpg',
      );
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'kupidon-photos',
            Key: 'users/u1/photo.jpg',
            ContentType: 'image/jpeg',
          }),
        }),
      );
    });
  });

  describe('delete / deleteMany', () => {
    it('deletes a single key', async () => {
      const service = makeService();

      await service.delete('users/u1/photo.jpg');

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { Bucket: 'kupidon-photos', Key: 'users/u1/photo.jpg' },
        }),
      );
    });

    it('no-ops for an empty key list without calling S3', async () => {
      const service = makeService();

      await service.deleteMany([]);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('batch-deletes multiple keys', async () => {
      const service = makeService();

      await service.deleteMany(['a', 'b']);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            Bucket: 'kupidon-photos',
            Delete: { Objects: [{ Key: 'a' }, { Key: 'b' }] },
          },
        }),
      );
    });
  });

  describe('listKeys', () => {
    it('follows pagination via ContinuationToken', async () => {
      sendMock
        .mockResolvedValueOnce({
          Contents: [{ Key: 'users/u1/a.jpg' }],
          NextContinuationToken: 'token-2',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'users/u1/b.jpg' }],
          NextContinuationToken: undefined,
        });
      const service = makeService();

      const keys = await service.listKeys('users/u1/');

      expect(keys).toEqual(['users/u1/a.jpg', 'users/u1/b.jpg']);
      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPublicUrl / getKeyFromUrl', () => {
    it('round-trips a key through a public URL', () => {
      const service = makeService();

      const url = service.getPublicUrl('users/u1/photo.jpg');

      expect(url).toBe(
        'http://127.0.0.1:9000/kupidon-photos/users/u1/photo.jpg',
      );
      expect(service.getKeyFromUrl(url)).toBe('users/u1/photo.jpg');
    });

    it('returns null for a URL outside the configured public base', () => {
      const service = makeService();

      expect(
        service.getKeyFromUrl('https://elsewhere.example/x.jpg'),
      ).toBeNull();
    });
  });
});
