import { ReferenceService } from './reference.service';

describe('ReferenceService.getCities search', () => {
  const whereCalls: Record<string, any>[] = [];
  const query = {
    where: jest.fn((filter: Record<string, any>) => {
      whereCalls.push(filter);
      return query;
    }),
    sort: jest.fn(() => query),
    limit: jest.fn(() => query),
    select: jest.fn(() => query),
    exec: jest.fn().mockResolvedValue([]),
  };
  const cityModel = { find: jest.fn(() => query) };
  const service = new ReferenceService(
    cityModel as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );

  beforeEach(() => {
    whereCalls.length = 0;
  });

  it('escapes regex metacharacters in the search term', async () => {
    await service.getCities({ search: '(a+)+$' });

    const [{ $or: conditions }] = whereCalls;
    expect(conditions[0].name.$regex).toBe('\\(a\\+\\)\\+\\$');
    expect(conditions[1].fullName.$regex).toBe('\\(a\\+\\)\\+\\$');
    expect(conditions[2].aliases.$in[0]).toEqual(/\(a\+\)\+\$/i);
  });

  it('still matches a plain city name', async () => {
    await service.getCities({ search: 'Moscow' });

    const [{ $or: conditions }] = whereCalls;
    expect(conditions[0].name.$regex).toBe('Moscow');
  });
});
