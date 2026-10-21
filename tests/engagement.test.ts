import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { likeProduct, likeState, recordEvent, unlikeProduct } from '@/lib/engagement';
import { createProduct, deleteProduct, updateProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
import { productEvents, productLikes } from '@/db/schema';
import { admin } from './helpers/actors';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const base = { name: 'Thing', category: 'Pottery', city: 'Jaipur', pricePaise: 100, description: 'D', stock: 1 };

describe('likes', () => {
  it('liking is idempotent per actor and counts distinct actors', async () => {
    expect(await likeProduct('p1', 'v:a')).toEqual({ liked: true, count: 1 });
    expect(await likeProduct('p1', 'v:a')).toEqual({ liked: true, count: 1 });
    expect(await likeProduct('p1', 'v:b')).toEqual({ liked: true, count: 2 });
    expect(await likeProduct('p1', 'u:me@x.co')).toEqual({ liked: true, count: 3 });
  });
  it('unliking removes only that actor\'s like and is idempotent', async () => {
    await likeProduct('p1', 'v:a'); await likeProduct('p1', 'v:b');
    expect(await unlikeProduct('p1', 'v:a')).toEqual({ liked: false, count: 1 });
    expect(await unlikeProduct('p1', 'v:a')).toEqual({ liked: false, count: 1 });
  });
  it('only published products can be liked; unknown or draft ids are 404', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ ...base, status: 'DRAFT', sellerId: s.id }, admin);
    await expect(likeProduct(draft.id, 'v:a')).rejects.toMatchObject({ status: 404, message: 'Product not found.' });
    await expect(likeProduct('nope', 'v:a')).rejects.toMatchObject({ status: 404 });
    await expect(unlikeProduct('nope', 'v:a')).rejects.toMatchObject({ status: 404 });
    expect(await (await getTestDb()).select().from(productLikes)).toHaveLength(0);
  });
  it('likeState returns counts for published products and which ones this actor liked; odd ids are ignored', async () => {
    await likeProduct('p1', 'v:a'); await likeProduct('p1', 'v:b'); await likeProduct('p2', 'v:a');
    const s = await likeState(['p1', 'p2', 'p3', 'p1', 'bogus', ''], 'v:a');
    expect(s.counts).toEqual({ p1: 2, p2: 1, p3: 0 });
    expect(s.liked.sort()).toEqual(['p1', 'p2']);
    expect((await likeState(['p1'])).liked).toEqual([]);          // no actor
    expect(Object.keys((await likeState(Array.from({ length: 200 }, (_, i) => `p${i}`))).counts).length).toBeLessThanOrEqual(60);
  });
  it('the public product JSON carries likeCount and sellerSlug but no actor data', async () => {
    await likeProduct('p1', 'v:secret-visitor'); await likeProduct('p1', 'u:private@x.co');
    const p = (await listProducts()).find(x => x.id === 'p1')!;
    expect(p.likeCount).toBe(2);
    expect(p.sellerSlug).toMatch(/^shauk-and-stuff-[0-9a-f]{8}$/);
    const json = JSON.stringify(p);
    for (const secret of ['secret-visitor', 'private@x.co', 'actor']) expect(json).not.toContain(secret);
    expect((await listProducts()).find(x => x.id === 'p4')!.likeCount).toBe(0);
  });
  it('deleting a product removes its likes and events', async () => {
    await likeProduct('p1', 'v:a'); await recordEvent({ productId: 'p1', type: 'view', actor: 'h:x' });
    await deleteProduct('p1');
    const db = await getTestDb();
    expect(await db.select().from(productLikes)).toHaveLength(0);
    expect(await db.select().from(productEvents)).toHaveLength(0);
  });
  it('concurrent likes: same actor many times = one row, different actors = exact count', async () => {
    await Promise.all(Array.from({ length: 20 }, () => likeProduct('p1', 'v:same')));
    expect((await likeState(['p1'])).counts.p1).toBe(1);
    await Promise.all(Array.from({ length: 25 }, (_, i) => likeProduct('p2', `v:${i}`)));
    expect((await likeState(['p2'])).counts.p2).toBe(25);
  });
});

describe('events', () => {
  const day = (iso: string) => new Date(iso);
  it('records one row per product+type+actor+UTC day; repeats are duplicates; a new day or type is new', async () => {
    const e = { productId: 'p1', type: 'view' as const, actor: 'h:a' };
    expect(await recordEvent(e, day('2026-10-20T10:00:00Z'))).toBe('recorded');
    expect(await recordEvent(e, day('2026-10-20T23:59:59Z'))).toBe('duplicate');
    expect(await recordEvent(e, day('2026-10-21T00:00:01Z'))).toBe('recorded');
    expect(await recordEvent({ ...e, type: 'contact' }, day('2026-10-20T10:00:00Z'))).toBe('recorded');
    expect(await recordEvent({ ...e, actor: 'h:b' }, day('2026-10-20T10:00:00Z'))).toBe('recorded');
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(4);
  });
  it('events for unknown, draft or archived products are ignored (nothing written)', async () => {
    const s = await makeSeller('d@x.co', 'D');
    const draft = await createProduct({ ...base, status: 'DRAFT', sellerId: s.id }, admin);
    const archived = await createProduct({ ...base, status: 'APPROVED', sellerId: s.id }, admin);
    await updateProduct(archived.id, { status: 'ARCHIVED' }, admin);
    for (const id of [draft.id, archived.id, 'nope']) expect(await recordEvent({ productId: id, type: 'view', actor: 'h:a' })).toBe('ignored');
    expect(await (await getTestDb()).select().from(productEvents)).toHaveLength(0);
  });
  it('the database refuses an unknown event type, and parallel identical events leave one row', async () => {
    const db = await getTestDb();
    await expect(db.insert(productEvents).values({ productId: 'p1', type: 'purchase', actor: 'h:a', day: '2026-10-20' })).rejects.toThrow();
    const rs = await Promise.all(Array.from({ length: 15 }, () => recordEvent({ productId: 'p2', type: 'view', actor: 'h:same' }, new Date('2026-10-20T10:00:00Z'))));
    expect(rs.filter(r => r === 'recorded')).toHaveLength(1);
    expect((await db.select().from(productEvents).where(eq(productEvents.productId, 'p2')))).toHaveLength(1);
  });
});

describe('product deleted between the published check and the write', () => {
  it('liking answers 404 (not a 500 foreign-key error)', async () => {
    const db = await getTestDb();
    const real = db.insert.bind(db);
    vi.spyOn(db, 'insert').mockImplementationOnce(((table: never) => { throw Object.assign(new Error('violates foreign key'), { code: '23503' }); void real; }) as never);
    await expect(likeProduct('p1', 'v:a')).rejects.toMatchObject({ status: 404, message: 'Product not found.' });
    vi.restoreAllMocks();
  });
  it('an event for it is ignored, not an error', async () => {
    const db = await getTestDb();
    vi.spyOn(db, 'insert').mockImplementationOnce((() => { throw Object.assign(new Error('violates foreign key'), { cause: { code: '23503' } }); }) as never);
    expect(await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' })).toBe('ignored');
    vi.restoreAllMocks();
  });
  it('other database errors still surface', async () => {
    const db = await getTestDb();
    vi.spyOn(db, 'insert').mockImplementationOnce((() => { throw new Error('boom'); }) as never);
    await expect(likeProduct('p1', 'v:a')).rejects.toThrow('boom');
    vi.restoreAllMocks();
  });
});
