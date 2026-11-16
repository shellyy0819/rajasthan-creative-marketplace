import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ cache: vi.fn((fn: unknown, key: string[], opts: unknown) => Object.assign(() => (fn as () => unknown)(), { key, opts })) }));
vi.mock('next/cache', () => ({ unstable_cache: h.cache }));

import { getDataVersion } from '@/lib/data-version';
import { getHomeShelf } from '@/lib/home-cache';

describe('data version', () => {
  it('has no time limit: it is only recreated when something is changed and the cache is cleared', () => {
    const v = getDataVersion as unknown as { key: string[]; opts: Record<string, unknown> };
    expect(v.opts).toEqual({ tags: ['data-version'] });
    expect(v.opts).not.toHaveProperty('revalidate');
    expect(v.key).not.toEqual((getHomeShelf as unknown as { key: string[] }).key);
  });
  it('is a different token every time the cache entry is created', async () => {
    const a = await getDataVersion(), b = await getDataVersion(); // the test cache wrapper does not memoise, so each call creates a new entry
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});
