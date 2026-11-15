import { beforeEach, describe, expect, it } from 'vitest';
import { countProductsByCategory, listProducts } from '@/lib/catalog';
import { GET } from '@/app/api/products/route';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
const get = (qs: string) => GET(new Request(`http://x/api/products${qs}`));

describe('listProducts pages', () => {
  it('pages are consecutive slices of the full list, in the same order, with nothing repeated or missed', async () => {
    const all = (await listProducts()).map(p => p.id);
    expect(all.length).toBeGreaterThan(2);
    const paged: string[] = [];
    for (let offset = 0; offset < all.length; offset += 2) paged.push(...(await listProducts({ limit: 2, offset })).map(p => p.id));
    expect(paged).toEqual(all);
    expect(await listProducts({ limit: 2, offset: all.length })).toEqual([]);
  });
  it('a page respects the category filter', async () => {
    const all = await listProducts();
    const category = all[0].category;
    const expected = all.filter(p => p.category === category).map(p => p.id);
    expect((await listProducts({ category, limit: 100 })).map(p => p.id)).toEqual(expected);
  });
});

describe('countProductsByCategory', () => {
  it('counts published products per category, A to Z, and agrees with the list', async () => {
    const all = await listProducts();
    const counts = await countProductsByCategory();
    expect(counts.map(c => c.name)).toEqual([...counts.map(c => c.name)].sort());
    expect(counts.reduce((n, c) => n + c.count, 0)).toBe(all.length);
    for (const c of counts) expect(all.filter(p => p.category === c.name)).toHaveLength(c.count);
  });
});

describe('GET /api/products paging', () => {
  it('returns one page with limit and offset, and the whole list without them', async () => {
    const all = await (await get('')).json();
    const page = await (await get('?limit=2&offset=1')).json();
    expect(page.map((p: { id: string }) => p.id)).toEqual(all.slice(1, 3).map((p: { id: string }) => p.id));
    expect(await (await get('?limit=2')).json()).toHaveLength(2);
  });
  it('rejects a limit or offset that is not a sensible whole number, naming it', async () => {
    for (const [qs, word] of [['?limit=0', 'limit'], ['?limit=49', 'limit'], ['?limit=x', 'limit'], ['?limit=-1', 'limit'], ['?limit=2&offset=-1', 'offset'], ['?limit=2&offset=1.5', 'offset']] as const) {
      const res = await get(qs);
      expect(res.status, qs).toBe(400);
      expect((await res.json()).error).toContain(word);
    }
    expect((await get('?offset=2')).status).toBe(400);
  });
});
