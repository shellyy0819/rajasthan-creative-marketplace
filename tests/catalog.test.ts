import { describe, it, expect, beforeEach } from 'vitest';
import {
  listProducts, listWorkshops, getProductBySlug, getWorkshopBySlug,
  productSlug, workshopSlug, cityFromSlug, citySlug,
} from '@/lib/catalog';
import { resetTestDb, getTestDb, giveRole } from './helpers/testdb';
import { products as productsTable } from '@/db/schema';

beforeEach(async () => {
  await resetTestDb();
});

describe('catalog', () => {
  it('lists all approved products with no filter', async () => {
    expect(await listProducts()).toHaveLength(4);
  });
  it('treats "All Rajasthan"/"All categories" as no filter', async () => {
    expect(await listProducts({ city: 'All Rajasthan', category: 'All categories' })).toHaveLength(4);
  });
  it('filters by city, category and q', async () => {
    expect((await listProducts({ city: 'Jaipur' })).map(p => p.id)).toEqual(['p3', 'p4']);
    expect((await listProducts({ category: 'Pottery' })).map(p => p.id)).toEqual(['p4']);
    expect((await listProducts({ q: 'FLOWER' })).map(p => p.id).sort()).toEqual(['p1', 'p3']);
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
  it('city slug round trip', () => {
    expect(citySlug('Udaipur')).toBe('udaipur');
    expect(cityFromSlug('jodhpur')).toBe('Jodhpur');
    expect(cityFromSlug('delhi')).toBeUndefined();
  });
});

describe('search text is a literal, injection-safe substring match', () => {
  const extra = () => ({ category: 'Pottery', city: 'Jaipur', pricePaise: 100, sellerId: sid, stock: 1, status: 'APPROVED' });
  let sid: string;
  beforeEach(async () => {
    const db = await getTestDb();
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
