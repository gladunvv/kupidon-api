import request from 'supertest';
import { testIds } from './test-app';
import { expectErrorEnvelope, expectMeta } from './support/assertions';
import { setupE2EApp } from './support/setup';

describe('ReferenceController (e2e)', () => {
  const { getApp } = setupE2EApp();

  it('GET /reference/cities returns filtered cities without auth', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/cities?country=RU&limit=5',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        countryCode: 'RU',
      }),
    );
    expectMeta(response.body);
  });

  it('GET /reference/cities validates limit', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/cities?limit=0',
    );

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('GET /reference/cities/popular returns popular cities', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/cities/popular?limit=1',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expectMeta(response.body);
  });

  it('GET /reference/cities/nearby returns nearby cities', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/cities/nearby?lat=55.75&lng=37.61&limit=1',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expectMeta(response.body);
  });

  it('GET /reference/cities/nearby returns bad request when coordinates are missing', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/cities/nearby',
    );

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Latitude and longitude are required',
    });
  });

  it('GET /reference/interests supports tag filtering', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/interests?tags=music',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.data[0].label).toBe('Music');
    expectMeta(response.body);
  });

  it('GET /reference/cities/nearby validates numeric query params', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/cities/nearby?lat=55.75&lng=37.61&maxDistance=0',
    );

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, { code: 'BAD_REQUEST' });
  });

  it('GET /reference/goals returns goals', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/goals',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expectMeta(response.body);
  });

  it('GET /reference/lifestyle-categories returns categories', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/lifestyle-categories',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expectMeta(response.body);
  });

  it('GET /reference/lifestyle-categories/:categoryId/options returns options', async () => {
    const response = await request(getApp().getHttpServer()).get(
      `/reference/lifestyle-categories/${testIds.category}/options`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expectMeta(response.body);
  });

  it('GET /reference/lifestyle-categories/:categoryId/options validates object id', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/lifestyle-categories/not-an-id/options',
    );

    expect(response.status).toBe(400);
    expectErrorEnvelope(response.body, {
      code: 'BAD_REQUEST',
      message: 'Invalid MongoDB ObjectId',
    });
  });

  it('GET /reference/lifestyle-categories/:categoryId/options returns 404 for unknown category', async () => {
    const response = await request(getApp().getHttpServer()).get(
      `/reference/lifestyle-categories/${testIds.missingCategory}/options`,
    );

    expect(response.status).toBe(404);
    expectErrorEnvelope(response.body, { code: 'NOT_FOUND' });
  });

  it('GET /reference/lifestyle-options returns all options', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/lifestyle-options',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expectMeta(response.body);
  });

  it('GET /reference/all returns all reference payloads', async () => {
    const response = await request(getApp().getHttpServer()).get(
      '/reference/all',
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        cities: expect.any(Array),
        interests: expect.any(Array),
        goals: expect.any(Array),
      }),
    );
    expectMeta(response.body);
  });
});
