import { AsyncLocalStorage } from 'async_hooks';

interface RequestContextStore {
  requestId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return asyncLocalStorage.run({ requestId }, fn);
}

export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}
