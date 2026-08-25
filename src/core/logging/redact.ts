// Case-insensitive substring match against key names. Substring (not exact)
// on purpose so variants like accessToken/refresh_token/Authorization all
// match without having to enumerate every naming convention.
const SENSITIVE_KEY_PATTERNS = [
  'phone',
  'otp',
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'refreshtokenhash',
  'ciphertext',
  'authtag',
  'encryption',
];

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (value instanceof Error) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redact(val, depth + 1);
  }
  return result;
}
