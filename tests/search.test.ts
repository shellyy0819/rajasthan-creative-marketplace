import { describe, it, expect, beforeEach } from 'vitest';
import { listProducts, listWorkshops } from '@/lib/catalog';
import { listProductsForAdmin } from '@/lib/admin-posts';
import { createProduct } from '@/lib/admin';
import { admin } from './helpers/actors';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { products } from '@/db/schema';

beforeEach(async () => { await resetTestDb(); });
const ids = async (q: string) => (await listProducts({ q })).map(p => p.id);
const base = { category: 'Resin Art', city: 'Jaipur', pricePaise: 100, description: 'plain', stock: 1 };

describe('fuzzy product search (typos still find the product)', () => {
  it('missing, extra, wrong and swapped letters', async () => {
    expect(await ids('crochat')).toContain('p1');      // wrong letter   (crochet)
    expect(await ids('crochett')).toContain('p1');     // extra letter
    expect(await ids('crocet')).toContain('p1');       // missing letter
    expect(await ids('crohcet')).toContain('p1');      // swapped letters
    expect(await ids('potery')).toContain('p4');       // Blue Pottery
    expect(await ids('pichloa')).toContain('p2');      // Pichola
    expect(await ids('resn')).toContain('p3');         // Resin
  });
  it('is case-insensitive and ignores extra whitespace', async () => {
    expect(await ids('  CROCHAT   ')).toContain('p1');
    expect(await ids('blue   potery')).toContain('p4');
  });
  it('multi-word queries with a typo in one word', async () => {
    expect(await ids('lily crochat')).toContain('p1');
    expect(await ids('coaster rezin')).toContain('p3');
  });
  it('matches the seller name and category too, with typos', async () => {
    expect(await ids('petl and pour')).toContain('p3');       // seller "Petal & Pour"
    expect(await ids('neel mitti studo')).toContain('p4');    // seller
    expect(await ids('acessories')).toContain('p2');          // category Accessories
  });
  it('unrelated text still returns nothing (no match-everything threshold)', async () => {
    for (const q of ['zzzzzz', 'xylophone', 'qwertyuiop', '1234567']) expect(await ids(q)).toEqual([]);
  });
  it('exact substring matches rank before fuzzy ones', async () => {
    const s = await makeSeller('rank@x.co', 'Rank Seller');
    await createProduct({ ...base, category: 'Pottery', name: 'Crochat Bowl', status: 'APPROVED', sellerId: s.id }, admin);  // fuzzy for "crochet"
    await createProduct({ ...base, category: 'Pottery', name: 'Crochet Charm', status: 'APPROVED', sellerId: s.id }, admin); // exact
    const found = (await listProducts({ q: 'crochet' })).map(p => p.name);
    expect(found).toContain('Crochat Bowl');
    expect(found.indexOf('Crochet Charm')).toBeLessThan(found.indexOf('Crochat Bowl'));
    expect(found.indexOf('Crochet Lily Bouquet')).toBeLessThan(found.indexOf('Crochat Bowl'));
  });
  it('very short queries (under 3 characters) are plain substring matches, never fuzzy', async () => {
    expect(await ids('zq')).toEqual([]);
    expect((await ids('cr')).length).toBeGreaterThan(0); // "Crochet", "Craft"…
    expect(await ids('b')).not.toEqual([]);
  });
  it('queries without a real word (digits/punctuation/2-letter words) never go fuzzy', async () => {
    for (const q of ["' or '1'='1", '1234567', '!!!???', 'a b c', '12 ab 34']) expect(await ids(q)).toEqual([]);
  });
  it('still literal for LIKE metacharacters and SQL text; huge input does not fail or match everything', async () => {
    expect(await ids('%')).toEqual([]);
    expect(await ids('_')).toEqual([]);
    expect(await ids("'; drop table products; --")).toEqual([]);
    expect(await ids('x'.repeat(10_000))).toEqual([]);
    expect((await listProducts()).length).toBe(4);
  });
  it('filters (city/category) still apply together with the fuzzy match', async () => {
    expect((await listProducts({ q: 'crochat', city: 'Jaipur' }))).toEqual([]);
    expect((await listProducts({ q: 'crochat', city: 'Udaipur' })).map(p => p.id)).toContain('p1');
  });
  it('drafts and archived products are never returned by public fuzzy search', async () => {
    const s = await makeSeller('d@x.co', 'D Seller');
    await createProduct({ ...base, name: 'Secret Crochet Draft', status: 'DRAFT', sellerId: s.id }, admin);
    expect((await listProducts({ q: 'crochat' })).map(p => p.name)).not.toContain('Secret Crochet Draft');
  });
  it('an empty or blank q returns the normal list', async () => {
    expect((await listProducts({ q: '' })).length).toBe(4);
    expect((await listProducts({ q: '   ' })).length).toBe(4);
  });
});

describe('fuzzy workshop search', () => {
  it('finds workshops by title, venue and host with typos', async () => {
    const w = async (q: string) => (await listWorkshops({ q })).map(x => x.id);
    expect(await w('begginer crochet')).toContain('w1');   // title
    expect(await w('courtyrd cafe')).toContain('w1');      // venue
    expect(await w('katha makrs')).toContain('w2');        // host
    expect(await w('zzzzzz')).toEqual([]);
  });
});

describe('fuzzy admin search', () => {
  it('admin list search tolerates typos and keeps drafts visible', async () => {
    const s = await makeSeller('adm@x.co', 'Adm Seller');
    await createProduct({ ...base, name: 'Hidden Crochet Draft', status: 'DRAFT', sellerId: s.id }, admin);
    const found = (await listProductsForAdmin({ q: 'crochat' })).map(p => p.name);
    expect(found).toContain('Hidden Crochet Draft');
    expect(found).toContain('Crochet Lily Bouquet');
    void getTestDb; void products;
  });
});
