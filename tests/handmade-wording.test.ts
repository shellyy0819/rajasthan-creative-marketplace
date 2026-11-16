import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateMetadata as productMeta } from '@/app/products/[slug]/page';
import { generateMetadata as artistMeta } from '@/app/artists/[slug]/page';
import { listProducts } from '@/lib/catalog';
import { productSlug } from '@/lib/catalog-shared';
import { isHandmade, madeByPhrase } from '@/lib/handmade';
import { products as productsT, sourcingTypes } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });

const type = (name: string, countsAsHandmade: boolean) => ({ id: 1, name, countsAsHandmade, showBadge: true });
describe('handmade wording helpers', () => {
  it('only a type that counts as handmade is called handmade', () => {
    expect(isHandmade({ sourcing: type('Handmade', true) })).toBe(true);
    expect(isHandmade({ sourcing: type('Curated', false) })).toBe(false);
    expect(isHandmade({})).toBe(false);
  });
  it('says who stands behind a product in words that are true', () => {
    expect(madeByPhrase({ sourcing: type('Handmade', true) })).toBe('Handmade by');
    expect(madeByPhrase({ sourcing: type('Curated', false) })).toBe('Curated by');
    expect(madeByPhrase({})).toBe('Sold by');
  });
});

describe('product and artist page metadata', () => {
  const setType = async (productId: string, name: string | null) => {
    const db = await getTestDb();
    const [t] = name ? await db.select().from(sourcingTypes).where(eq(sourcingTypes.name, name)) : [];
    await db.update(productsT).set({ sourcingTypeId: t?.id ?? null }).where(eq(productsT.id, productId));
  };
  const first = async () => (await listProducts())[0];
  const productText = async (id: string) => { const p = (await listProducts()).find(x => x.id === id)!; const m = await productMeta({ params: Promise.resolve({ slug: productSlug(p) }) }); return `${m.title} | ${m.description}`; };
  const artistText = async (slug: string) => { const m = await artistMeta({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) }); return `${m.title} | ${m.description}`; };

  it('a handmade product is described as handmade', async () => {
    const p = await first(); await setType(p.id, 'Handmade');
    expect(await productText(p.id)).toMatch(/handmade in .*\| .*Handmade by /);
  });
  it('a curated, resold or untyped product is never called handmade, and says how it was sourced', async () => {
    const p = await first();
    // The product's own description may say anything; what the page adds must not claim handmade.
    const claims = (t: string) => /handmade in|Handmade by/.test(t);
    await setType(p.id, 'Curated'); expect(claims(await productText(p.id))).toBe(false); expect(await productText(p.id)).toContain('Curated by');
    await setType(p.id, 'Resold'); expect(claims(await productText(p.id))).toBe(false); expect(await productText(p.id)).toContain('Resold by');
    await setType(p.id, null); expect(claims(await productText(p.id))).toBe(false); expect(await productText(p.id)).toContain('Sold by');
  });
  it('an artist page claims handmade only while every one of their products is handmade', async () => {
    const p = await first(); const slug = p.sellerSlug!;
    const mine = (await listProducts()).filter(x => x.sellerSlug === slug);
    for (const x of mine) await setType(x.id, 'Handmade');
    expect(await artistText(slug)).toMatch(/handmade by an independent artist.*handmade piece/s);
    await setType(mine[0].id, 'Curated');
    const text = await artistText(slug);
    expect(text).not.toMatch(/handmade by an independent artist|handmade pieces?\b/i);
    expect(text).toContain('an independent artist');
  });
});
