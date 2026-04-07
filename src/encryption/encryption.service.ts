import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyVersion = 1;
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY;

    if (!rawKey) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY is not configured',
      );
    }

    const key = Buffer.from(rawKey, 'hex');

    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'ENCRYPTION_KEY must be 32 bytes encoded as hex',
      );
    }

    this.key = key;
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = crypto.randomBytes(12); // standard size for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(payload.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
