import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const KEY_V1 = '0'.repeat(64);
const KEY_V2 = '1'.repeat(64);

const makeConfigService = (config: unknown) => ({
  getOrThrow: jest.fn().mockReturnValue(config),
});

const createService = (config: unknown) =>
  new EncryptionService(makeConfigService(config) as never);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: makeConfigService({
            currentVersion: 1,
            keys: [{ version: 1, key: KEY_V1 }],
          }),
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('decrypts a payload back to the original plaintext', () => {
    const plaintext = 'sensitive data';

    const payload = service.encrypt(plaintext);

    expect(service.decrypt(payload)).toBe(plaintext);
  });

  it('produces a different ciphertext and iv for repeated encryptions of the same plaintext', () => {
    const plaintext = 'sensitive data';

    const first = service.encrypt(plaintext);
    const second = service.encrypt(plaintext);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('rejects decryption when the ciphertext has been tampered with', () => {
    const payload = service.encrypt('sensitive data');
    const tampered = {
      ...payload,
      ciphertext: Buffer.from('tampered payload').toString('base64'),
    };

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects decryption when the auth tag has been tampered with', () => {
    const payload = service.encrypt('sensitive data');
    const tampered = {
      ...payload,
      authTag: Buffer.from(
        Buffer.from(payload.authTag, 'base64').map((byte, index) =>
          index === 0 ? byte ^ 0xff : byte,
        ),
      ).toString('base64'),
    };

    expect(() => service.decrypt(tampered)).toThrow();
  });

  describe('key rotation', () => {
    it('tags newly encrypted payloads with the current key version', () => {
      const rotated = createService({
        currentVersion: 2,
        keys: [
          { version: 1, key: KEY_V1 },
          { version: 2, key: KEY_V2 },
        ],
      });

      const payload = rotated.encrypt('sensitive data');

      expect(payload.keyVersion).toBe(2);
    });

    it('still decrypts data encrypted under a previous key version after rotation', () => {
      const beforeRotation = createService({
        currentVersion: 1,
        keys: [{ version: 1, key: KEY_V1 }],
      });
      const payload = beforeRotation.encrypt('old message');

      const afterRotation = createService({
        currentVersion: 2,
        keys: [
          { version: 1, key: KEY_V1 },
          { version: 2, key: KEY_V2 },
        ],
      });

      expect(afterRotation.decrypt(payload)).toBe('old message');
    });

    it('throws a clear error when decrypting a payload from a retired key version', () => {
      const beforeRotation = createService({
        currentVersion: 1,
        keys: [{ version: 1, key: KEY_V1 }],
      });
      const payload = beforeRotation.encrypt('old message');

      const afterRetirement = createService({
        currentVersion: 2,
        keys: [{ version: 2, key: KEY_V2 }],
      });

      expect(() => afterRetirement.decrypt(payload)).toThrow(
        'No encryption key configured for version 1',
      );
    });

    it('fails fast at startup when currentVersion has no matching key', () => {
      expect(() =>
        createService({
          currentVersion: 3,
          keys: [{ version: 1, key: KEY_V1 }],
        }),
      ).toThrow(
        'encryption.currentVersion (3) has no matching entry in encryption.keys',
      );
    });
  });
});
