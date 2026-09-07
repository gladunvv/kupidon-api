import request from 'supertest';
import { createAuthorizedSession, testIds } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('BlockController (contract)', () => {
  const { getApp } = setupE2EApp();

  it('POST /users/:targetUserId/block blocks a user', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post(`/users/${testIds.matchedUser}/block`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
  });

  it('POST /users/:targetUserId/block rejects self-block', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post(`/users/${testIds.user}/block`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Cannot block yourself',
    });
  });

  it('POST /users/:targetUserId/block validates the object id', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/users/invalid-id/block')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('requires authentication', async () => {
    const response = await request(getApp().getHttpServer()).post(
      `/users/${testIds.matchedUser}/block`,
    );

    expect(response.status).toBe(401);
  });

  it('DELETE /users/:targetUserId/block unblocks a user', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .delete(`/users/${testIds.matchedUser}/block`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual({ unblocked: true });
  });
});

describe('ReportController (contract)', () => {
  const { getApp } = setupE2EApp();

  it('POST /users/:targetUserId/report submits a report', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post(`/users/${testIds.matchedUser}/report`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'spam', details: 'Sent me a link' });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
  });

  it('POST /users/:targetUserId/report rejects self-report', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post(`/users/${testIds.user}/report`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'spam' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Cannot report yourself',
    });
  });

  it('POST /users/:targetUserId/report validates the reason enum', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post(`/users/${testIds.matchedUser}/report`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'not-a-real-reason' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('requires authentication', async () => {
    const response = await request(getApp().getHttpServer())
      .post(`/users/${testIds.matchedUser}/report`)
      .send({ reason: 'spam' });

    expect(response.status).toBe(401);
  });
});
