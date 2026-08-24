import { redact } from './redact';

describe('redact', () => {
  it('passes through primitives and non-sensitive keys unchanged', () => {
    expect(redact('hello')).toBe('hello');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact({ userId: 'abc', count: 3 })).toEqual({
      userId: 'abc',
      count: 3,
    });
  });

  it.each([
    'phone',
    'otp',
    'password',
    'token',
    'accessToken',
    'refresh_token',
    'Authorization',
    'cookie',
    'secret',
    'refreshTokenHash',
    'ciphertext',
    'authTag',
  ])('redacts the sensitive key "%s"', (key) => {
    const result = redact({ [key]: 'super-secret-value' }) as Record<
      string,
      unknown
    >;

    expect(result[key]).toBe('[REDACTED]');
  });

  it('redacts sensitive keys inside nested objects and arrays', () => {
    const result = redact({
      user: { phone: '+79990001122', name: 'Vlad' },
      attempts: [{ otp: '1234' }, { otp: '5678' }],
    }) as any;

    expect(result.user.phone).toBe('[REDACTED]');
    expect(result.user.name).toBe('Vlad');
    expect(result.attempts[0].otp).toBe('[REDACTED]');
    expect(result.attempts[1].otp).toBe('[REDACTED]');
  });

  it('does not mutate the original value', () => {
    const original = { phone: '+79990001122' };

    redact(original);

    expect(original.phone).toBe('+79990001122');
  });

  it('leaves Error instances untouched instead of flattening them', () => {
    const error = new Error('boom');

    expect(redact(error)).toBe(error);
  });
});
