import request from 'supertest';
import { createAuthorizedSession } from './test-app';
import {
  expectErrorEnvelope,
  expectSuccessEnvelope,
} from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('UploadController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('GET /upload/photos returns 401 without auth', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/upload/photos',
    );

    expect(response.status).toBe(401);
    expectErrorEnvelope(response.body, {
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
  });

  it('POST /upload/photos uploads files', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/upload/photos')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('photos', Buffer.from('first'), 'first.jpg')
      .attach('photos', Buffer.from('second'), 'second.jpg');

    expect(response.status).toBe(201);
    expectSuccessEnvelope(response.body);
    expect(response.body.data.photos).toEqual([
      '/uploads/first.jpg',
      '/uploads/second.jpg',
    ]);
  });

  it('POST /upload/photos returns bad request when no files provided', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .post('/upload/photos')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'No photos provided',
    });
  });

  it('POST /upload/photos returns bad request when file count exceeds limit', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const req = request(getApp().getHttpServer())
      .post('/upload/photos')
      .set('Authorization', `Bearer ${accessToken}`);

    for (let i = 0; i < 6; i += 1) {
      req.attach('photos', Buffer.from(`file-${i}`), `file-${i}.jpg`);
    }

    const response = await req;

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('DELETE /upload/photo deletes photo', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .delete('/upload/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ photoPath: '/uploads/photo-1.jpg' });

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data).toBeNull();
  });

  it('DELETE /upload/photo validates empty body value', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .delete('/upload/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ photoPath: '' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('DELETE /upload/photo validates missing body value', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .delete('/upload/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('DELETE /upload/photo returns 400 for unknown photo', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .delete('/upload/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ photoPath: '/uploads/missing.jpg' });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'NOT_FOUND' });
  });

  it('PUT /upload/photos/reorder reorders photos', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/upload/photos/reorder')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        photoOrder: ['/uploads/photo-2.jpg', '/uploads/photo-1.jpg'],
      });

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data.photos).toEqual([
      '/uploads/photo-2.jpg',
      '/uploads/photo-1.jpg',
    ]);
  });

  it('PUT /upload/photos/reorder validates empty order array', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/upload/photos/reorder')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ photoOrder: [] });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'PHOTO_COUNT_MISMATCH' });
  });

  it('PUT /upload/photos/reorder returns bad request for invalid photo items', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .put('/upload/photos/reorder')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        photoOrder: ['/uploads/photo-2.jpg', '/uploads/missing.jpg'],
      });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'INVALID_PHOTOS' });
  });

  it('GET /upload/photos returns current user photos', async () => {
    const { accessToken } = await createAuthorizedSession(getApp());

    const response = await request(getApp().getHttpServer())
      .get('/upload/photos')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expectSuccessEnvelope(response.body);
    expect(response.body.data.photos).toEqual([
      '/uploads/photo-1.jpg',
      '/uploads/photo-2.jpg',
    ]);
  });
});
