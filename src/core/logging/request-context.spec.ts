import { getRequestId, runWithRequestId } from './request-context';

describe('request context', () => {
  it('returns undefined outside of any request context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('exposes the request id set for the current run', () => {
    runWithRequestId('req-1', () => {
      expect(getRequestId()).toBe('req-1');
    });
  });

  it('keeps concurrent contexts isolated from each other', async () => {
    const seenIds: string[] = [];

    await Promise.all([
      runWithRequestId('req-a', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        seenIds.push(getRequestId()!);
      }),
      runWithRequestId('req-b', async () => {
        seenIds.push(getRequestId()!);
      }),
    ]);

    expect(seenIds.sort()).toEqual(['req-a', 'req-b']);
  });

  it('does not leak the request id after the run completes', () => {
    runWithRequestId('req-1', () => {});

    expect(getRequestId()).toBeUndefined();
  });
});
