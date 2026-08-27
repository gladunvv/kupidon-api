import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EncryptionConfig } from '../config/config.schema';

type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly currentVersion: number;
  private readonly keysByVersion: Map<number, Buffer>;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getOrThrow<EncryptionConfig>(
      'encryption',
      { infer: true },
    );

    this.currentVersion = config.currentVersion;
    this.keysByVersion = new Map(
      config.keys.map((entry) => [
        entry.version,
        Buffer.from(entry.key, 'hex'),
      ]),
    );

    if (!this.keysByVersion.has(this.currentVersion)) {
      throw new Error(
        `encryption.currentVersion (${this.currentVersion}) has no matching entry in encryption.keys`,
      );
    }
  }

  encrypt(plaintext: string): EncryptedPayload {
    const key = this.keysByVersion.get(this.currentVersion)!;
    const iv = crypto.randomBytes(12); // standard size for GCM
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.currentVersion,
    };
  }

  decrypt(payload: EncryptedPayload): string {
    const key = this.keysByVersion.get(payload.keyVersion);
    if (!key) {
      throw new Error(
        `No encryption key configured for version ${payload.keyVersion}`,
      );
    }

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
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
