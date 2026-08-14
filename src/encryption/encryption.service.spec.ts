import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('0'.repeat(64)),
          },
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
});
