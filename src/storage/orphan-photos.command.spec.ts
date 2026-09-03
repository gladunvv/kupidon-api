import { findOrphanKeys, keyFromUrl } from './orphan-photos.command';

describe('orphan photo sweep', () => {
  describe('keyFromUrl', () => {
    const publicUrl = 'http://127.0.0.1:9000/kupidon-photos';

    it('extracts the key for a URL under the configured public base', () => {
      expect(keyFromUrl(`${publicUrl}/users/u1/a.jpg`, publicUrl)).toBe(
        'users/u1/a.jpg',
      );
    });

    it('tolerates a trailing slash on the configured public base', () => {
      expect(keyFromUrl(`${publicUrl}/users/u1/a.jpg`, `${publicUrl}/`)).toBe(
        'users/u1/a.jpg',
      );
    });

    it('returns null for a URL outside the configured public base', () => {
      expect(
        keyFromUrl('https://elsewhere.example/a.jpg', publicUrl),
      ).toBeNull();
    });
  });

  describe('findOrphanKeys', () => {
    it('returns storage keys that are not referenced by any user', () => {
      const storageKeys = [
        'users/u1/a.jpg',
        'users/u1/b.jpg',
        'users/u2/c.jpg',
      ];
      const referenced = new Set(['users/u1/a.jpg', 'users/u2/c.jpg']);

      expect(findOrphanKeys(storageKeys, referenced)).toEqual([
        'users/u1/b.jpg',
      ]);
    });

    it('returns an empty list when every object is referenced', () => {
      const storageKeys = ['users/u1/a.jpg'];
      const referenced = new Set(['users/u1/a.jpg']);

      expect(findOrphanKeys(storageKeys, referenced)).toEqual([]);
    });
  });
});
