import request from 'supertest';
import { createAuthorizedSession, testIds } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('MatchController (contract)', () => {
  const { getApp } = setupE2EApp();

  it('POST /match/like creates simple like', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/v1/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: testIds.pendingUser });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({ matched: false });
  });

  it('POST /match/like returns match payload on mutual like', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/v1/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: testIds.matchedUser });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        matched: true,
        match: expect.objectContaining({ _id: testIds.match }),
        dialog: expect.objectContaining({ _id: testIds.dialog }),
      }),
    );
  });

  it('POST /match/like rejects self-like', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/v1/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: testIds.user });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'CANNOT_TARGET_SELF',
      message: 'Cannot like yourself',
    });
  });

  it('POST /match/like validates likedUserId', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/v1/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: 'invalid-id' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('GET /match returns current user matches', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/match')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(expect.any(Array));
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNext: false,
    });
  });

  it('GET /match/:matchId returns match details', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/v1/match/${testIds.match}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        match: expect.objectContaining({ _id: testIds.match }),
        partner: expect.any(Object),
      }),
    );
  });

  it('GET /match/:matchId validates object id', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/v1/match/invalid-id')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'INVALID_OBJECT_ID',
      message: 'Invalid MongoDB ObjectId',
    });
  });

  it('GET /match/:matchId returns 404 for unknown match', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/v1/match/${testIds.missingMatch}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expectErrorEnvelope(response.body, { code: 'MATCH_NOT_FOUND' });
  });
});
