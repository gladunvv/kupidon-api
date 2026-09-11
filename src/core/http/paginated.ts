import { PaginationMeta } from '../types/api-response.interface';

// Marker recognized by ResponseInterceptor: it unwraps `items` into the
// envelope's `data` field and `pagination` into `meta.pagination`, so every
// list endpoint reports paging the same way regardless of how it built the
// page (offset skip/limit, aggregation $facet, etc).
export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly pagination: PaginationMeta,
  ) {}
}

export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): Paginated<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return new Paginated(items, {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
  });
}
