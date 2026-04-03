import request from 'supertest';
import {
  createAuthorizedSession,
  defaultOtp,
  defaultPhone,
  testIds,
} from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('AuthController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('POST /auth/request-otp sends OTP', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/auth/request-otp')
      .set('x-request-id', 'req-auth-otp')
      .send({ phone: defaultPhone });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body, {
      message: 'OTP sent successfully',
      requestId: 'req-auth-otp',
      hasData: false,
    });
  });

  it('POST /auth/request-otp validates missing phone', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/auth/request-otp')
      .send({});

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('POST /auth/request-otp validates phone format', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/auth/request-otp')
      .send({ phone: '12345' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('POST /auth/verify-otp returns access token and refresh cookie', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: defaultPhone, otp: defaultOtp });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body, {
      message: 'OTP verified successfully',
    });
    expect(response.body.data).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        user: expect.objectContaining({
          _id: testIds.user,
          phone: defaultPhone,
        }),
      }),
    );
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=')]),
    );
  });

  it('POST /auth/verify-otp validates missing otp', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: defaultPhone });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('POST /auth/verify-otp returns 401 for invalid otp', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/auth/verify-otp')
      .send({ phone: defaultPhone, otp: '0000' });

    expect(response.status).toBe(401);
    expectErrorEnvelope(response.body, {
      code: 'INVALID_OTP',
      message: 'Invalid OTP code',
    });
  });

  it('POST /auth/refresh-token refreshes token using cookie', async () => {
    const session = await createAuthorizedSession(getApp());

    const response = await session.agent.post('/auth/refresh-token');

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body, {
      message: 'Token refreshed successfully',
    });
    expect(response.body.data).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        user: expect.objectContaining({ _id: testIds.user }),
      }),
    );
  });

  it('POST /auth/refresh-token returns 401 without cookie', async () => {
    const response = await request(getApp().getHttpServer()).post(
      '/auth/refresh-token',
    );

    expect(response.status).toBe(401);
    expectErrorEnvelope(response.body, {
      code: 'INVALID_TOKEN',
      message: 'Refresh token not found',
    });
  });

  it('POST /auth/logout clears refresh token cookie', async () => {
    const session = await createAuthorizedSession(getApp());

    const response = await session.agent.post('/auth/logout');

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body, {
      message: 'Token cleared successfully',
    });
    expect(response.body.data).toBeNull();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=;')]),
    );
  });
});
