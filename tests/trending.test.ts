import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { trending, trendingBreakdown } from '@/lib/trending';
import { likeProduct, recordEvent } from '@/lib/engagement';
import { createProduct, updateProduct } from '@/lib/admin';
import { productLikes } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const NOW = new Date('2026-10-21T12:00:00Z');
beforeEach(async () => { await resetTestDb(); });
const ids = async (o: { limit?: number } = {}) => (await trending({ ...o, now: NOW })).map(p => p.id);
const views = async (productId: string, n: number, at = '2026-10-20T10:00:00Z') => { for (let i = 0; i < n; i++) await view(productId, `h:${productId}-${i}`, at); };
const view = (productId: string, actor: string, at = '2026-10-20T10:00:00Z') => recordEvent({ productId, type: 'view', actor }, new Date(at));

describe('trending()', () => {
  it('is empty when nothing has any activity', async () => { expect(await ids()).toEqual([]); });
  it('ranks by the weighted mix and returns public products with like counts', async () => {
    for (const a of ['h:1', 'h:2', 'h:3']) await view('p1', a);                 // p1: 3 views
    await view('p2', 'h:1');                                                    // p2: 1 view ...
    await recordEvent({ productId: 'p2', type: 'contact', actor: 'h:1' }, new Date('2026-10-20T10:00:00Z'));
    await recordEvent({ productId: 'p2', type: 'artist', actor: 'h:1' }, new Date('2026-10-20T10:00:00Z'));
    await likeProduct('p2', 'v:a'); await likeProduct('p2', 'v:b');             // ... + contact + artist + 2 likes
    const out = await trending({ now: NOW });
    expect(out.map(p => p.id)).toEqual(['p2', 'p1']);                           // 0.35/3 + .25 + .2 + .2 = .767 > .35
    expect(out[0]).toMatchObject({ name: 'Pichola Boat Bag Charm', likeCount: 2 });
    expect(out[0]).not.toHaveProperty('sellerId');
  });
  it('counts unique people: the same visitor on several days is several day-rows but one person', async () => {
    await view('p1', 'h:same', '2026-10-18T10:00:00Z'); await view('p1', 'h:same', '2026-10-19T10:00:00Z'); await view('p1', 'h:same', '2026-10-20T10:00:00Z');
    await views('p2', 3);
    expect(await ids()).toEqual(['p2']);                                        // 3 unique people list; 1 person on 3 days does not
  });
  it('only the last 7 days count: older events and likes are ignored', async () => {
    await views('p1', 2, '2026-10-10T10:00:00Z');                              // 11 days old
    await view('p1', 'h:b', '2026-10-14T10:00:00Z');                           // 7 days old: day 2026-10-14 is outside the 7-day window ending 2026-10-21 (21..15)
    expect(await ids()).toEqual([]);
    await views('p3', 3, '2026-10-15T00:00:01Z');                              // inside
    expect(await ids()).toEqual(['p3']);
    const db = await getTestDb();
    await likeProduct('p4', 'v:old');
    await db.update(productLikes).set({ createdAt: new Date('2026-10-01T00:00:00Z') }).where(eq(productLikes.productId, 'p4'));
    expect(await ids()).toEqual(['p3']);
  });
  it('shows at most one product per artist (their best), even if one artist has the top three', async () => {
    const s = await makeSeller('star@x.co', 'Star Artist');
    const mk = async (name: string) => (await createProduct({ name, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin)).id;
    const [a, b, c] = [await mk('Star A'), await mk('Star B'), await mk('Star C')];
    for (const [pid, n] of [[a, 5], [b, 4], [c, 3]] as const) for (let i = 0; i < n; i++) await view(pid, `h:${pid}${i}`);
    await views('p1', 3); await views('p2', 3);
    const out = await ids();
    expect(out.filter(x => [a, b, c].includes(x))).toEqual([a]);
    expect(out).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(out).toHaveLength(3);
  });
  it('respects the limit (default 6, clamped to 1..24) and ignores nonsense', async () => {
    const s = await makeSeller('many@x.co', 'Many');
    for (let i = 0; i < 30; i++) { const m = await makeSeller(`m${i}@x.co`, `Maker ${i}`); const p = await createProduct({ name: `P${i}`, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: m.id }, admin); await views(p.id, 3); }
    void s;
    expect((await ids()).length).toBe(6);
    expect((await ids({ limit: 3 })).length).toBe(3);
    expect((await ids({ limit: 999 })).length).toBe(24);
    for (const limit of [0, -5, Number.NaN]) expect((await ids({ limit: limit as number })).length).toBeGreaterThanOrEqual(1);
  });
  it('unpublished products never appear, even with plenty of old activity', async () => {
    await view('p1', 'h:a'); await likeProduct('p1', 'v:a');
    await updateProduct('p1', { status: 'ARCHIVED' }, admin);
    expect(await ids()).toEqual([]);
    await updateProduct('p1', { status: 'DRAFT' }, admin);
    expect(await ids()).toEqual([]);
  });
  it('a single view never lists a product; 3 distinct viewers, a like or a contact click does', async () => {
    await view('p1', 'h:a');
    expect(await ids()).toEqual([]);
    await view('p1', 'h:b'); await view('p1', 'h:c');
    expect(await ids()).toEqual(['p1']);
    await likeProduct('p2', 'v:a');
    expect(await ids()).toEqual(['p1', 'p2']);                                  // 3 viewers (.35) beat one like (.2)
    await recordEvent({ productId: 'p3', type: 'artist', actor: 'h:z' }, new Date('2026-10-20T10:00:00Z'));
    expect(await ids()).toEqual(['p1', 'p2']);                                  // an artist click alone is not enough
  });
  it('trendingBreakdown explains every approved product: parts add up to the score and statuses match the row', async () => {
    for (const a of ['h:1', 'h:2', 'h:3']) await view('p1', a);
    await view('p2', 'h:1');
    const b = await trendingBreakdown({ now: NOW });
    const p1 = b.rows.find(r => r.productId === 'p1')!, p2 = b.rows.find(r => r.productId === 'p2')!;
    expect(p1.status).toBe('shown'); expect(p1.rank).toBe(1);
    expect(p1.score).toBeCloseTo(Object.values(p1.parts).reduce((x, y) => x + y, 0));
    expect(p2.status).toBe('below-threshold'); expect(p2.rank).toBeNull(); expect(p2.score).toBe(0);
    expect(b.max.views).toBe(3);
    expect((await ids())).toEqual(b.rows.filter(r => r.status === 'shown').map(r => r.productId));
  });
});
