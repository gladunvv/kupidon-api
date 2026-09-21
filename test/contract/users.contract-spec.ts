import request from 'supertest';
import { createAuthorizedSession, defaultPhone, testIds } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('UsersController (contract)', () => {
  const { getApp } = setupE2EApp();

  it('GET /users returns 401 without auth', async () => {
    const response = await request(getApp().getHttpServer()).get('/v1/users');

    expect(response.status).toBe(401);
    expectErrorEnvelope(response.body, {
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  });

  it('GET /users returns current profile', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        _id: testIds.user,
        phone: defaultPhone,
      }),
    );
  });

  it('GET /users/profile/complete returns profile completeness', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users/profile/complete')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        profileCompleteness: 100,
        missingRequiredFields: expect.any(Array),
      }),
    );
  });

  it('GET /users/list returns matching candidates', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users/list?page=1&limit=2')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(expect.any(Array));
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 2,
      totalPages: 1,
      hasNext: false,
    });
  });

  it('GET /users/list validates pagination query', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users/list?page=0&limit=101')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('PUT /users updates profile', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Updated Vlad',
        about: 'Updated bio',
        height: 185,
      });

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        name: 'Updated Vlad',
        about: 'Updated bio',
        height: 185,
      }),
    );
  });

  it('PUT /users validates profile payload', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        age: 16,
        photos: [123],
      });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('PUT /users rejects fields outside the profile contract', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Vlad',
        phone: '+79990009999',
        isVerified: true,
      });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });

    const profile = await request(getApp().getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profile.body.data.phone).toBe(defaultPhone);
  });

  it('PUT /users rejects photos, which only the upload endpoints own', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ photos: ['https://cdn.example.com/users/other-user/1.jpg'] });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('PATCH /users/search-preferences validates request body', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .patch('/v1/users/search-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        minAge: 17,
        maxDistance: 0,
      });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('PATCH /users/search-preferences updates preferences', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .patch('/v1/users/search-preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        minAge: 24,
        maxAge: 32,
        maxDistance: 40,
        genders: ['female'],
      });

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data.searchPreferences).toEqual(
      expect.objectContaining({
        minAge: 24,
        maxAge: 32,
        maxDistance: 40,
        genders: ['female'],
      }),
    );
  });

  it('GET /users/nearby returns nearby users', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users/nearby?lat=55.75&lng=37.61&maxDistance=30')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(expect.any(Array));
    expect(response.body.meta.pagination).toEqual(
      expect.objectContaining({ total: 1 }),
    );
  });

  it('GET /users/nearby validates numeric query params', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users/nearby?lat=abc&limit=0')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('GET /users/compatibility/:targetUserId returns compatibility', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/v1/users/compatibility/${testIds.matchedUser}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        totalScore: 86,
        factors: expect.any(Array),
        recommendation: expect.any(String),
      }),
    );
  });

  it('GET /users/compatibility/:targetUserId validates object id', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/users/compatibility/not-an-id')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'INVALID_OBJECT_ID',
      message: 'Invalid MongoDB ObjectId',
    });
  });

  it('GET /users/compatibility/:targetUserId returns 404 for unknown user', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/v1/users/compatibility/${testIds.missingUser}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expectErrorEnvelope(response.body, { code: 'USER_NOT_FOUND' });
  });

  it('DELETE /users deletes the account and invalidates the session', async () => {
    const { agent, accessToken } = await createAuthorizedSession(getApp());

    const response = await agent
      .delete('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.headers['set-cookie']?.[0]).toMatch(/refresh_token=;/);

    const profileAfterDeletion = await request(getApp().getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(profileAfterDeletion.status).toBe(401);
  });

  it('DELETE /users returns 401 without auth', async () => {
    const response = await request(getApp().getHttpServer()).delete(
      '/v1/users',
    );

    expect(response.status).toBe(401);
    expectErrorEnvelope(response.body, {
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  });
});
