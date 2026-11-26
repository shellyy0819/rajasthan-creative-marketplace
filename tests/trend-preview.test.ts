import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ cookie: undefined as string | undefined, session: null as unknown, auth: vi.fn(), matchItems: vi.fn() }));
// No Next cache outside a request: call straight through, but hand back what the real cache would (JSON), so a Date that is cached would come back as text. Calls and options are recorded.
const cache = vi.hoisted(() => ({ calls: [] as unknown[][], opts: undefined as undefined | { revalidate?: number; tags?: string[] }, keyParts: undefined as undefined | string[] }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[], opts: { revalidate?: number; tags?: string[] }) => {
    cache.opts = opts; cache.keyParts = keyParts;
    return async (...a: unknown[]) => { cache.calls.push(a); const v = await fn(...a); return v === undefined ? v : JSON.parse(JSON.stringify(v)); };
  },
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => (n === 'rr_trend_preview' && mocks.cookie !== undefined ? { name: n, value: mocks.cookie } : undefined) }) }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/trend-match', async orig => {
  const actual = await orig<typeof import('@/lib/trend-match')>();
  mocks.matchItems.mockImplementation(actual.matchItems);
  return { ...actual, matchItems: mocks.matchItems };
});

import { getTrendsForPage, TREND_PREVIEW_COOKIE } from '@/lib/trend-preview';
import { createDigest, publishDigest } from '@/lib/trend-store';
import type { TrendItem } from '@/lib/trend-types';
import { resetTestDb } from './helpers/testdb';

const item = (id: string, over: Partial<TrendItem> = {}): TrendItem => ({
  id, kind: 'craft', title: `Item ${id}`, why: 'Buyers keep asking for this lately.', category: 'Pottery', tags: ['clay'],
  origin: 'web', sources: [{ title: 'Design weekly', url: 'https://example.com/a' }], show: true, ...over,
});
const make = (items: TrendItem[]) => createDigest({ createdBy: 'root@x.co', model: 'test-model', status: 'ok', items });
const asAdmin = () => { mocks.session = { user: { email: 'root@x.co', role: 'admin' } }; };

beforeAll(async () => { await resetTestDb(); }, 30_000);
beforeEach(async () => {
  mocks.cookie = undefined; mocks.session = null;
  mocks.auth.mockReset(); mocks.auth.mockImplementation(async () => mocks.session);
  mocks.matchItems.mockClear(); cache.calls.length = 0;
  await resetTestDb();
}, 30_000);

describe('getTrendsForPage', () => {
  it('names the cookie', () => { expect(TREND_PREVIEW_COOKIE).toBe('rr_trend_preview'); });

  it('is null with nothing published and no preview, and does no matching or sign-in check', async () => {
    expect(await getTrendsForPage()).toBeNull();
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.matchItems).not.toHaveBeenCalled();
  });

  it('gives a visitor the published digest: shown items only, matched, with the source line and date', async () => {
    const d = await make([item('a'), item('b', { show: false }), item('c', { origin: 'manual', kind: 'art' }), item('d', { origin: 'pinterest' })]);
    const p = await publishDigest(d.id, 'root@x.co');
    const r = (await getTrendsForPage())!;
    expect(r.previewing).toBe(false);
    expect(r.items.map(i => i.id)).toEqual(['a', 'c', 'd']);
    expect(r.items[0]).toMatchObject({ count: expect.any(Number), href: expect.stringMatching(/^\/shop/) });
    expect(r.sourceLine).toBe('Gathered from Pinterest, public web sources and our own research, then picked by our team.');
    expect(r.updatedOn).toEqual(p.publishedAt);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.matchItems).toHaveBeenCalledTimes(1);
    expect(mocks.matchItems.mock.calls[0][0].map((i: TrendItem) => i.id)).toEqual(['a', 'c', 'd']);
  });

  it('builds the source line only from the shown items', async () => {
    const d = await make([item('a', { origin: 'manual' }), item('b', { origin: 'pinterest', show: false })]);
    await publishDigest(d.id, 'root@x.co');
    expect((await getTrendsForPage())!.sourceLine).toBe('Gathered from our own research, then picked by our team.');
  });

  it('a visitor with a valid draft cookie still gets only the published digest', async () => {
    const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
    const draft = await make([item('d')]);
    mocks.cookie = draft.id;
    const r = (await getTrendsForPage())!;
    expect(r.previewing).toBe(false);
    expect(r.items.map(i => i.id)).toEqual(['p']);
  });

  it('a signed-in non-admin, a deactivated admin and a seller get the published digest too', async () => {
    const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
    const draft = await make([item('d')]);
    mocks.cookie = draft.id;
    for (const user of [{ email: 'u@x.co', role: 'customer' }, { email: 's@x.co', role: 'seller' }, { email: 'root@x.co', role: 'admin', active: false }]) {
      mocks.session = { user };
      const r = (await getTrendsForPage())!;
      expect(r.previewing).toBe(false);
      expect(r.items.map(i => i.id)).toEqual(['p']);
    }
  });

  it('an admin with the cookie sees the draft: its shown items and previewing true', async () => {
    const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
    const draft = await make([item('d1'), item('d2', { show: false }), item('d3', { kind: 'workshop', title: 'Clay day', category: undefined, tags: [] })]);
    asAdmin(); mocks.cookie = draft.id;
    const r = (await getTrendsForPage())!;
    expect(r.previewing).toBe(true);
    expect(r.items.map(i => i.id)).toEqual(['d1', 'd3']);
    expect(r.items[1]).toMatchObject({ count: 0, href: '/workshops' });
    expect(r.updatedOn).toEqual(draft.createdAt);
  });

  it('an admin previewing a draft with nothing shown gets null when nothing is published', async () => {
    const draft = await make([item('d', { show: false })]);
    asAdmin(); mocks.cookie = draft.id;
    expect(await getTrendsForPage()).toBeNull();
    expect(mocks.matchItems).not.toHaveBeenCalled();
  });

  it('an admin previewing a draft with nothing shown falls back to the published digest, with no preview claim', async () => {
    const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
    const draft = await make([item('d', { show: false })]);
    asAdmin(); mocks.cookie = draft.id;
    const r = (await getTrendsForPage())!;
    expect(r.previewing).toBe(false);
    expect(r.items.map(i => i.id)).toEqual(['p']);
  });

  it('an admin previewing the published digest sees it normally, with no preview claim', async () => {
    const pub = await make([item('p')]); const p = await publishDigest(pub.id, 'root@x.co');
    asAdmin(); mocks.cookie = pub.id;
    const r = (await getTrendsForPage())!;
    expect(r.previewing).toBe(false);
    expect(r.items.map(i => i.id)).toEqual(['p']);
    expect(r.updatedOn).toEqual(p.publishedAt);
  });

  it('ignores garbage cookie text without asking who is signed in, and shows the published digest', async () => {
    const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
    asAdmin();
    for (const v of ['', 'garbage', '1', "' or 1=1 --", randomUUID() + 'x', 'x' + randomUUID(), '../../x']) {
      mocks.cookie = v; mocks.auth.mockClear();
      const r = (await getTrendsForPage())!;
      expect(r.previewing).toBe(false);
      expect(r.items.map(i => i.id)).toEqual(['p']);
      expect(mocks.auth).not.toHaveBeenCalled();
    }
  });

  it('ignores an unknown uuid, even for an admin', async () => {
    const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
    asAdmin(); mocks.cookie = randomUUID();
    const r = (await getTrendsForPage())!;
    expect(r.previewing).toBe(false);
    expect(r.items.map(i => i.id)).toEqual(['p']);
  });

  it('is null for a published digest whose items are all hidden', async () => {
    const d = await make([item('a')]);
    await publishDigest(d.id, 'root@x.co');
    const { getDb } = await import('@/db/client');
    const { trendDigests } = await import('@/db/schema');
    await getDb().update(trendDigests).set({ items: [item('a', { show: false })] });
    expect(await getTrendsForPage()).toBeNull();
    expect(mocks.matchItems).not.toHaveBeenCalled();
  });

  describe('caching', () => {
    it('the published path goes through the cache wrapper keyed by the digest id, with a short revalidate and the trends tag', async () => {
      const d = await make([item('a')]); await publishDigest(d.id, 'root@x.co');
      await getTrendsForPage();
      expect(cache.calls).toEqual([[d.id]]);
      expect(cache.opts).toMatchObject({ revalidate: 300, tags: ['trends'] });
    });
    it('gives updatedOn back as a Date after a cached read, taken from the live digest', async () => {
      const d = await make([item('a')]); const p = await publishDigest(d.id, 'root@x.co');
      const r = (await getTrendsForPage())!;
      expect(r.updatedOn).toBeInstanceOf(Date);
      expect(r.updatedOn).toEqual(p.publishedAt);
      expect(typeof r.sourceLine).toBe('string');
      expect(r.items[0]).toMatchObject({ id: 'a', count: expect.any(Number) });
    });
    it('does not use the cache when there is nothing published, or for a previewed draft', async () => {
      await getTrendsForPage();
      const pub = await make([item('p')]); await publishDigest(pub.id, 'root@x.co');
      const draft = await make([item('d')]);
      cache.calls.length = 0;
      asAdmin(); mocks.cookie = draft.id;
      const r = (await getTrendsForPage())!;
      expect(r.previewing).toBe(true);
      expect(cache.calls).toEqual([]);
    });
  });
});
