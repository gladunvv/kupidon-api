import request from 'supertest';
import { expectErrorEnvelope, expectMeta } from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('SeedController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('POST /seed/run runs seed successfully', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/seed/run')
      .send({
        clearExisting: false,
        models: ['goals'],
        verbose: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      'Заполнение базы данных завершено успешно',
    );
    expect(response.body.options).toEqual({
      clearExisting: false,
      models: ['goals'],
      verbose: false,
    });
    expectMeta(response.body);
  });

  it('POST /seed/run returns bad request for unsupported model', async () => {
    const response = await request(getApp().getHttpServer())
      .post('/seed/run')
      .send({
        models: ['broken'],
      });

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Unsupported seed model',
    });
  });

  it('POST /seed/quick parses query params', async () => {
    const response = await request(getApp().getHttpServer()).post(
      '/seed/quick?clear=false&models=goals,interests&verbose=false',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.options).toEqual({
      clearExisting: false,
      models: ['goals', 'interests'],
      verbose: false,
    });
    expectMeta(response.body);
  });

  it('GET /seed/stats returns stats', async () => {
    const response = await request(getApp().getHttpServer()).get('/seed/stats');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.total).toBe(7);
    expectMeta(response.body);
  });

  it('GET /seed/models returns available models', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/seed/models',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.available).toEqual(
      expect.arrayContaining(['goals', 'interests']),
    );
    expectMeta(response.body);
  });
});
