import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../test-app';

export const setupE2EApp = () => {
  let app: INestApplication;
  let resetState: () => void;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    resetState = testApp.resetState;
  });

  beforeEach(() => {
    resetState();
  });

  afterAll(async () => {
    await app.close();
  });

  return { getApp: () => app };
};
