import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ cache: vi.fn((fn: unknown, key: string[], opts: unknown) => Object.assign(() => (fn as () => unknown)(), { key, opts })), list: vi.fn(async () => []), counts: vi.fn(async () => []), trend: vi.fn(async () => []) }));
vi.mock('next/cache', () => ({ unstable_cache: h.cache }));
vi.mock('@/lib/catalog', () => ({ listProducts: h.list, countProductsByCategory: h.counts }));
vi.mock('@/lib/trending', () => ({ trending: h.trend }));

import { getHomeShelf, getHomeTrending, HOME_PRODUCTS_TTL, HOME_TRENDING_TTL } from '@/lib/home-cache';
import { SHELF_PAGE_SIZE } from '@/lib/catalog-shared';

beforeEach(() => { h.list.mockClear(); h.counts.mockClear(); h.trend.mockClear(); });

describe('home-page data cache', () => {
  it('wraps products and trending with a TTL and a tag', () => {
    const p = getHomeShelf as unknown as { key: string[]; opts: unknown }, t = getHomeTrending as unknown as { key: string[]; opts: unknown };
    expect(p.opts).toEqual({ revalidate: HOME_PRODUCTS_TTL, tags: ['home-products'] });
    expect(t.opts).toEqual({ revalidate: HOME_TRENDING_TTL, tags: ['home-trending'] });
    expect(p.key).not.toEqual(t.key);
  });
  it('loads only the first page of the catalogue with the category counts, and the top six trending items', async () => {
    await getHomeShelf(); await getHomeTrending();
    expect(h.list).toHaveBeenCalledWith({ limit: SHELF_PAGE_SIZE });
    expect(h.counts).toHaveBeenCalledWith();
    expect(h.trend).toHaveBeenCalledWith({ limit: 6 });
  });
});
