import { describe, it, expect, beforeEach } from 'vitest';
import {
  listProducts, listWorkshops, getProductBySlug, getWorkshopBySlug,
  productSlug, workshopSlug,
} from '@/lib/catalog';
import { resetTestDb, getTestDb, giveRole } from './helpers/testdb';
import { products as productsTable } from '@/db/schema';
import { getCityBySlug } from '@/lib/cities';

beforeEach(async () => {
  await resetTestDb();
});

describe('catalog', () => {
  it('lists all approved products with no filter', async () => {
    expect(await listProducts()).toHaveLength(4);
  });
  it('treats "All India"/"All categories" as no filter', async () => {
    expect(await listProducts({ city: 'All India', category: 'All categories' })).toHaveLength(4);
  });
  it('filters by city, category and q', async () => {
    expect((await listProducts({ city: 'Jaipur' })).map(p => p.id)).toEqual(['p3', 'p4']);
    expect((await listProducts({ category: 'Pottery' })).map(p => p.id)).toEqual(['p4']);
    expect((await listProducts({ q: 'FLOWER' })).map(p => p.id).sort()).toEqual(['p1', 'p3']);
  });
  it('city filter accepts a name or a slug, case-insensitively, with the same result', async () => {
    const a = (await listProducts({ city: 'udaipur' })).map(p => p.id);
    const b = (await listProducts({ city: 'Udaipur' })).map(p => p.id);
    expect(a).toEqual(['p1', 'p2']);
    expect(b).toEqual(a);
    expect((await listWorkshops({ city: 'jaipur' })).map(w => w.id)).toEqual((await listWorkshops({ city: 'Jaipur' })).map(w => w.id));
  });
  it('an unknown city yields no results instead of an error', async () => {
    expect(await listProducts({ city: 'Nowhere' })).toEqual([]);
    expect(await listWorkshops({ city: 'Nowhere' })).toEqual([]);
  });
  it('products and workshops carry cityId, citySlug and the display name', async () => {
    const jaipur = (await getCityBySlug('jaipur'))!;
    const [p] = await listProducts({ city: 'Jaipur' });
    expect(p).toMatchObject({ city: 'Jaipur', cityId: jaipur.id, citySlug: 'jaipur', cityState: 'Rajasthan' });
    const w = await listWorkshops({ city: 'Jaipur' });
    for (const x of w) expect(x).toMatchObject({ city: 'Jaipur', cityId: jaipur.id, citySlug: 'jaipur' });
    expect(await getWorkshopBySlug(workshopSlug((await listWorkshops())[0]))).toHaveProperty('cityId');
  });
  it('filters workshops by type', async () => {
    expect((await listWorkshops({ type: 'FREE' })).map(w => w.id)).toEqual(['w3']);
    expect(await listWorkshops({ type: 'ALL' })).toHaveLength(3);
  });
  it('slugs are name + id and resolve exactly', async () => {
    const [p] = await listProducts();
    expect(productSlug(p)).toBe('crochet-lily-bouquet-p1');
    expect((await getProductBySlug('crochet-lily-bouquet-p1'))?.id).toBe('p1');
    const [w] = await listWorkshops();
    expect(workshopSlug(w)).toBe('beginner-crochet-make-your-first-flower-w1');
    expect((await getWorkshopBySlug(workshopSlug(w)))?.id).toBe('w1');
  });
  it('rejects right id with wrong name part, and unknown slugs', async () => {
    expect(await getProductBySlug('anything-p1')).toBeUndefined();
    expect(await getProductBySlug('nope')).toBeUndefined();
    expect(await getWorkshopBySlug('x-w1')).toBeUndefined();
  });
  it('city slug round trip (cities come from the cities table, not a hard-coded list)', async () => {
    expect((await getCityBySlug('jodhpur'))?.name).toBe('Jodhpur');
    expect(await getCityBySlug('delhi')).toBeUndefined();
    const catalog: Record<string, unknown> = await import('@/lib/catalog');
    expect(catalog).not.toHaveProperty('CITIES');
    expect(catalog).not.toHaveProperty('cityFromSlug');
  });
});

describe('search text is a literal, injection-safe substring match', () => {
  const extra = () => ({ category: 'Pottery', cityId: cid, pricePaise: 100, sellerId: sid, stock: 1, status: 'APPROVED' });
  let sid: string, cid: number;
  beforeEach(async () => {
    const db = await getTestDb();
    cid = (await getCityBySlug('jaipur'))!.id;
    sid = (await giveRole('odd@seller.co', 'seller')).id;
    await db.insert(productsTable).values([
      { id: 'p91', name: 'Rock 100% Cotton', description: 'soft', ...extra() },
      { id: 'p92', name: 'Under_score Dish', description: 'plain', ...extra() },
      { id: 'p93', name: 'Back\\slash Bowl', description: 'plain', ...extra() },
    ]);
  });
  it('treats % _ and \\ literally', async () => {
    expect((await listProducts({ q: '100%' })).map(p => p.id)).toEqual(['p91']);
    expect((await listProducts({ q: '%' })).map(p => p.id)).toEqual(['p91']);
    expect((await listProducts({ q: '_' })).map(p => p.id)).toEqual(['p92']);
    expect((await listProducts({ q: '\\' })).map(p => p.id)).toEqual(['p93']);
  });
  it('quotes and SQL fragments are just text; tables stay intact', async () => {
    expect(await listProducts({ q: "'; drop table products; --" })).toEqual([]);
    expect(await listProducts({ q: "' or '1'='1" })).toEqual([]);
    expect((await listProducts()).length).toBe(7);
  });
  it('a 10 000 character query returns an empty list instead of failing', async () => {
    expect(await listProducts({ q: 'x'.repeat(10_000) })).toEqual([]);
  });
  it('matching is still case-insensitive and ordered by id (p2 before p10)', async () => {
    expect((await listProducts({ q: 'FLOWER' })).map(p => p.id)).toEqual(['p1', 'p3']);
    const db = await getTestDb();
    await db.insert(productsTable).values({ id: 'p10', name: 'Ten', description: 'd', ...extra() });
    const ids = (await listProducts()).map(p => p.id);
    expect(ids.indexOf('p2')).toBeLessThan(ids.indexOf('p10'));
  });
});

describe('catalog: sourcing type', () => {
  // p1 Curated, p2 not set (its text says handmade), p3 and p4 stay Handmade
  async function classify() {
    const { eq } = await import('drizzle-orm');
    const { sourcingTypes } = await import('@/db/schema');
    const db = await getTestDb();
    const ids = Object.fromEntries((await db.select().from(sourcingTypes)).map(t => [t.name, t.id]));
    await db.update(productsTable).set({ sourcingTypeId: ids.Curated }).where(eq(productsTable.id, 'p1'));
    await db.update(productsTable).set({ sourcingTypeId: null, description: 'A handmade bowl' }).where(eq(productsTable.id, 'p2'));
    return { db, ids };
  }
  it('source lists only products of that type, ignoring case; a product with no type never matches', async () => {
    await classify();
    expect((await listProducts({ source: 'Handmade' })).map(p => p.id)).toEqual(['p3', 'p4']);
    expect((await listProducts({ source: 'curated' })).map(p => p.id)).toEqual(['p1']);
    expect(await listProducts({ source: 'Nope' })).toEqual([]);
  });
  it('a search that is exactly a type name finds products of that type and products whose text says the word', async () => {
    const { db } = await classify();
    const ids = async (q: string) => (await listProducts({ q })).map(p => p.id).sort();
    // p1 Curated, text says handmade; p2 not set, text says handmade; p3 Handmade, text too; p4 Handmade, text does not say it
    expect(await ids('handmade')).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(await ids('  Handmade ')).toEqual(['p1', 'p2', 'p3', 'p4']);
    // p2 not set and its text no longer says it: not found. p4 is still found, by its type alone.
    const { eq } = await import('drizzle-orm');
    await db.update(productsTable).set({ description: 'A tiny bowl' }).where(eq(productsTable.id, 'p2'));
    expect(await ids('handmade')).toEqual(['p1', 'p3', 'p4']);
    expect(await ids('CURATED')).toEqual(['p1']);                 // by type only
  });
  it('products found by their text come before those found only by their type', async () => {
    await classify();
    const found = (await listProducts({ q: 'handmade' })).map(p => p.id);
    expect(found).toHaveLength(4);
    expect(found[found.length - 1]).toBe('p4');
  });
  it('a type and other filters or words combine', async () => {
    await classify();
    expect((await listProducts({ source: 'Handmade', q: 'FLOWER' })).map(p => p.id)).toEqual(['p3']);
    expect((await listProducts({ source: 'Handmade', city: 'Jaipur' })).map(p => p.id)).toEqual(['p3', 'p4']);
    expect((await listProducts({ q: 'handmade bowl' }))[0].id).toBe('p2'); // more than the bare type name: ordinary text search, best match first
  });
  it('a switched-off type name is an ordinary word again', async () => {
    const { db } = await classify();
    const { sourcingTypes } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(sourcingTypes).set({ active: false }).where(eq(sourcingTypes.name, 'Resold'));
    await db.update(productsTable).set({ description: 'resold in a set' }).where(eq((await import('@/db/schema')).products.id, 'p4'));
    expect((await listProducts({ q: 'resold' })).map(p => p.id)).toEqual(['p4']);
  });
});
