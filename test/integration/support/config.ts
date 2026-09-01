export const integrationConfig = {
  encryption: {
    currentVersion: 1,
    keys: [{ version: 1, key: '0'.repeat(64) }],
  },
  otp: {
    ttlSeconds: 2,
    length: 4,
    cooldownSeconds: 1,
    requestWindowSeconds: 10,
    maxRequestsPerWindow: 2,
    maxRequestsPerIpWindow: 10,
    maxVerifyAttempts: 2,
    blockSeconds: 2,
  },
  jwt: {
    secret: 'integration-access-secret',
    secret_refresh: 'integration-refresh-secret',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
    refreshCookieMaxAge: 604800000,
  },
};
