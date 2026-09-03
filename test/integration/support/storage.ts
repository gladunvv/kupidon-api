import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../../src/storage/storage.service';

export const INTEGRATION_S3_ENDPOINT =
  process.env.INTEGRATION_S3_ENDPOINT ?? 'http://127.0.0.1:9000';
export const INTEGRATION_S3_ACCESS_KEY_ID =
  process.env.INTEGRATION_S3_ACCESS_KEY_ID ?? 'minioadmin';
export const INTEGRATION_S3_SECRET_ACCESS_KEY =
  process.env.INTEGRATION_S3_SECRET_ACCESS_KEY ?? 'minioadmin';
export const INTEGRATION_S3_BUCKET =
  process.env.INTEGRATION_S3_BUCKET ?? 'kupidon-integration-test';
export const INTEGRATION_S3_PUBLIC_URL =
  process.env.INTEGRATION_S3_PUBLIC_URL ??
  `${INTEGRATION_S3_ENDPOINT}/${INTEGRATION_S3_BUCKET}`;

export function createTestStorageService(): StorageService {
  const configService = {
    getOrThrow: () => ({
      endpoint: INTEGRATION_S3_ENDPOINT,
      region: 'us-east-1',
      bucket: INTEGRATION_S3_BUCKET,
      accessKeyId: INTEGRATION_S3_ACCESS_KEY_ID,
      secretAccessKey: INTEGRATION_S3_SECRET_ACCESS_KEY,
      publicUrl: INTEGRATION_S3_PUBLIC_URL,
    }),
  } as unknown as ConfigService;

  return new StorageService(configService);
}
