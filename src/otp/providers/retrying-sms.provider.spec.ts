import { RetryingSmsProvider } from './retrying-sms.provider';
import { SmsProvider, SmsSendResult } from './sms-provider.interface';

describe('RetryingSmsProvider', () => {
  const makeDelegate = (...results: SmsSendResult[]): SmsProvider => {
    const send = jest.fn();
    for (const result of results) {
      send.mockResolvedValueOnce(result);
    }
    return { send };
  };

  it('returns immediately on the first successful attempt', async () => {
    const delegate = makeDelegate({ success: true, providerMessageId: 'ok' });
    const provider = new RetryingSmsProvider(delegate, {
      maxAttempts: 3,
      backoffMs: 1,
    });

    const result = await provider.send('+79990001122', 'code');

    expect(result).toEqual({ success: true, providerMessageId: 'ok' });
    expect(delegate.send).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds once the delegate recovers', async () => {
    const delegate = makeDelegate(
      { success: false, error: 'timeout' },
      { success: false, error: 'timeout' },
      { success: true, providerMessageId: 'ok-on-third-try' },
    );
    const provider = new RetryingSmsProvider(delegate, {
      maxAttempts: 3,
      backoffMs: 1,
    });

    const result = await provider.send('+79990001122', 'code');

    expect(result).toEqual({
      success: true,
      providerMessageId: 'ok-on-third-try',
    });
    expect(delegate.send).toHaveBeenCalledTimes(3);
  });

  it('gives up and returns the last failure after exhausting all attempts', async () => {
    const delegate = makeDelegate(
      { success: false, error: 'timeout' },
      { success: false, error: 'timeout' },
      { success: false, error: 'provider rejected the number' },
    );
    const provider = new RetryingSmsProvider(delegate, {
      maxAttempts: 3,
      backoffMs: 1,
    });

    const result = await provider.send('+79990001122', 'code');

    expect(result).toEqual({
      success: false,
      error: 'provider rejected the number',
    });
    expect(delegate.send).toHaveBeenCalledTimes(3);
  });

  it('does not retry beyond a single call when maxAttempts is 1', async () => {
    const delegate = makeDelegate({ success: false, error: 'down' });
    const provider = new RetryingSmsProvider(delegate, {
      maxAttempts: 1,
      backoffMs: 1,
    });

    await provider.send('+79990001122', 'code');

    expect(delegate.send).toHaveBeenCalledTimes(1);
  });
});
