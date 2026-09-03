import { StorageService } from '../../src/storage/storage.service';
import { createTestStorageService } from './support/storage';

describe('StorageService (real MinIO)', () => {
  let service: StorageService;

  beforeAll(async () => {
    service = createTestStorageService();
    await service.onModuleInit();
  });

  it('round-trips an upload through its public URL and deletes it', async () => {
    const key = `users/it-${Date.now()}/a.jpg`;

    const url = await service.upload(key, Buffer.from('hello'), 'image/jpeg');
    expect(url).toBe(service.getPublicUrl(key));
    expect(service.getKeyFromUrl(url)).toBe(key);

    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('hello');

    await service.delete(key);
    const afterDelete = await fetch(url);
    expect(afterDelete.status).toBe(404);
  });

  it('lists keys under a prefix and supports batch deletion', async () => {
    const prefix = `users/it-list-${Date.now()}`;
    const keys = [`${prefix}/a.jpg`, `${prefix}/b.jpg`];
    await Promise.all(
      keys.map((key) => service.upload(key, Buffer.from('x'), 'image/jpeg')),
    );

    const listed = await service.listKeys(prefix);
    expect([...listed].sort()).toEqual([...keys].sort());

    await service.deleteMany(keys);
    expect(await service.listKeys(prefix)).toEqual([]);
  });

  it('is a no-op when batch-deleting an empty key list', async () => {
    await expect(service.deleteMany([])).resolves.toBeUndefined();
  });
});
