import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createProduct } from '@/lib/admin';
import { createCategory } from '@/lib/categories';
import { getCategoryEntry, listCategoryIndex, listCategoryPage, slugForCategory } from '@/lib/category-pages';
import { categories } from '@/db/schema';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

type Seller = Awaited<ReturnType<typeof makeSeller>>;
let a: Seller;

const add = (name: string, category: string, status = 'APPROVED') =>
  createProduct({ name, category, cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status, sellerId: a.id }, admin);

beforeEach(async () => {
  await resetTestDb();
  a = await makeSeller('a@x.co', 'Studio A');
  for (const name of ['Crochet', 'Crochet & Textiles', 'Brass Work', 'Empty Category']) await createCategory({ name }, 'a@x.co');
});

describe('category pages library', () => {
  it('lists only categories that have approved products, sorted by name, with counts', async () => {
    await add('T-C1', 'Crochet'); await add('T-C2', 'Crochet'); await add('T-B1', 'Brass Work');
    const idx = await listCategoryIndex();
    const mine = idx.filter(e => ['Crochet', 'Brass Work', 'Empty Category'].includes(e.name));
    expect(mine.map(e => [e.name, e.count])).toEqual([['Brass Work', 1], ['Crochet', 2]]);
    expect(idx.map(e => e.name)).toEqual([...idx.map(e => e.name)].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase())));
    expect(mine.map(e => e.slug)).toEqual(['brass-work', 'crochet']);
  });
  it('a category whose products are all drafts has no entry and no page', async () => {
    await add('T-D1', 'Brass Work', 'DRAFT');
    expect((await listCategoryIndex()).some(e => e.name === 'Brass Work')).toBe(false);
    expect(await getCategoryEntry('brass-work')).toBeUndefined();
    expect(await slugForCategory('Brass Work')).toBeUndefined();
  });
  it('getCategoryEntry finds by slug and returns the product count; unknown slugs are undefined', async () => {
    await add('T-C1', 'Crochet'); await add('T-C2', 'Crochet');
    expect(await getCategoryEntry('crochet')).toEqual({ name: 'Crochet', slug: 'crochet', count: 2 });
    expect(await getCategoryEntry('nope')).toBeUndefined();
    expect(await getCategoryEntry('')).toBeUndefined();
  });
  it('exact match: Crochet does not list Crochet & Textiles products', async () => {
    await add('T-C1', 'Crochet'); await add('T-CT1', 'Crochet & Textiles');
    const e = (await getCategoryEntry('crochet'))!;
    const page = await listCategoryPage(e, 1);
    expect(page.products.map(p => p.name)).toEqual(['T-C1']);
    expect(page.total).toBe(1);
    expect(e.count).toBe(1);
  });
  it('a page holds 12 products in the shop\'s order, with the total and the page count', async () => {
    for (let i = 1; i <= 14; i++) await add(`T-B${i}`, 'Brass Work');
    const e = (await getCategoryEntry('brass-work'))!;
    const p1 = await listCategoryPage(e, 1), p2 = await listCategoryPage(e, 2);
    expect([p1.products.length, p2.products.length, p1.total, p1.pages]).toEqual([12, 2, 14, 2]);
    expect(p1.products.map(p => p.name)).toEqual(Array.from({ length: 12 }, (_, i) => `T-B${i + 1}`));   // the same order /shop uses (oldest id first)
    expect(p2.products.map(p => p.name)).toEqual(['T-B13', 'T-B14']);
  });
  it('a renamed category keeps its slug and its products', async () => {
    await add('T-B1', 'Brass Work');
    const d = await getTestDb();
    await d.update(categories).set({ name: 'Brassware' }).where(eq(categories.name, 'Brass Work'));
    const e = await getCategoryEntry('brass-work');
    expect(e).toEqual({ name: 'Brassware', slug: 'brass-work', count: 1 });
    expect((await listCategoryPage(e!, 1)).products.map(p => p.name)).toEqual(['T-B1']);
  });
  it('slugForCategory returns the slug, or undefined for a category with no products', async () => {
    await add('T-B1', 'Brass Work');
    expect(await slugForCategory('Brass Work')).toBe('brass-work');
    expect(await slugForCategory('Empty Category')).toBeUndefined();
    expect(await slugForCategory('Does Not Exist')).toBeUndefined();
  });
});
