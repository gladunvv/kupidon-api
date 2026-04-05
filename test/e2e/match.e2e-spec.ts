import request from 'supertest';
import { createAuthorizedSession, testIds } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('MatchController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('POST /match/like creates simple like', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: testIds.pendingUser });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({ matched: false });
  });

  it('POST /match/like returns match payload on mutual like', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/match/like')
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
      .post('/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: testIds.user });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Cannot like yourself',
    });
  });

  it('POST /match/like validates likedUserId', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/match/like')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ likedUserId: 'invalid-id' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('GET /match returns current user matches', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/match')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(expect.any(Array));
    expect(response.body.data).toHaveLength(1);
  });

  it('GET /match/:matchId returns match details', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/match/${testIds.match}`)
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
      .get('/match/invalid-id')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Invalid MongoDB ObjectId',
    });
  });

  it('GET /match/:matchId returns 404 for unknown match', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/match/${testIds.missingMatch}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expectErrorEnvelope(response.body, { code: 'NOT_FOUND' });
  });
});
