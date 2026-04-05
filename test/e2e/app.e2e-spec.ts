import request from 'supertest';
import { createAuthorizedSession } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('AppController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('GET / returns 401 without auth', async () => {
    const response = await request(getApp().getHttpServer()).get('/');

    expect(response.status).toBe(401);
    expectErrorEnvelope(response.body, {
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  });

  it('GET / returns wrapped success response for authenticated user', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toBe('Hello World!');
  });
});
