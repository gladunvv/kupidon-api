import request from 'supertest';
import { createAuthorizedSession, testIds } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('DialogController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('GET /dialogs returns dialog list', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/dialogs')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(expect.any(Array));
    expect(response.body.data).toHaveLength(1);
  });

  it('POST /dialogs/create creates dialog', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/dialogs/create')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ matchId: testIds.match });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        _id: testIds.dialog,
        matchId: testIds.match,
      }),
    );
  });

  it('POST /dialogs/create validates matchId', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/dialogs/create')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ matchId: 'invalid-id' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('POST /dialogs/create returns 404 for unknown match', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/dialogs/create')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ matchId: testIds.missingMatch });

    expect(response.status).toBe(404);
    expectErrorEnvelope(response.body, { code: 'NOT_FOUND' });
  });

  it('GET /dialogs/:id returns dialog details', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/dialogs/${testIds.dialog}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        _id: testIds.dialog,
        partner: expect.any(Object),
        messages: expect.any(Array),
      }),
    );
  });

  it('GET /dialogs/:id/messages returns dialog messages', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/dialogs/${testIds.dialog}/messages`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        messages: expect.any(Array),
        messagesCount: 1,
        partner: expect.any(Object),
      }),
    );
  });

  it('GET /dialogs/:id validates object id', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/dialogs/invalid-id')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Invalid MongoDB ObjectId',
    });
  });

  it('GET /dialogs/:id returns 404 for unknown dialog', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get(`/dialogs/${testIds.missingDialog}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expectErrorEnvelope(response.body, { code: 'NOT_FOUND' });
  });

  it('POST /dialogs/:id/messages sends message', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post(`/dialogs/${testIds.dialog}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'Новое сообщение' });

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        text: 'Новое сообщение',
        sender: expect.any(Object),
      }),
    );
  });

  it('POST /dialogs/:id/messages validates empty and oversized text', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const emptyResponse = await request(getApp().getHttpServer())
      .post(`/dialogs/${testIds.dialog}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: '   ' });

    expect(emptyResponse.status).toBe(400);
    expectErrorEnvelope(emptyResponse.body, { code: 'BAD_REQUEST' });

    const longResponse = await request(getApp().getHttpServer())
      .post(`/dialogs/${testIds.dialog}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'a'.repeat(1001) });

    expect(longResponse.status).toBe(400);
    expectErrorEnvelope(longResponse.body, { code: 'BAD_REQUEST' });
  });
});
