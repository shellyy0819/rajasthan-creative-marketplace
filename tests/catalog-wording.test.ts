import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn })); // no Next cache outside a request: call straight through
import { capitalize, describeCatalog, joinWords, loadCatalogWording, siteCopy } from '@/lib/catalog-wording';
import { products, sourcingTypes } from '@/db/schema';
import { getTestDb, resetTestDb } from './helpers/testdb';

const S = { products: 10, makers: 3, cities: 2 };
const t = (name: string, countsAsHandmade: boolean, count: number) => ({ name, countsAsHandmade, count });

describe('describeCatalog', () => {
  it('names the sourcing types in use, and only those', () => {
    expect(describeCatalog([t('Handmade', true, 5)], 0, S).products).toBe('handmade products');
    expect(describeCatalog([t('Handmade', true, 5), t('Curated', false, 2)], 0, S).products).toBe('handmade and curated products');
    expect(describeCatalog([t('Handmade', true, 5), t('Curated', false, 2), t('Resold', false, 1)], 0, S).finds).toBe('handmade, curated and resold finds');
    expect(describeCatalog([t('Handmade', true, 5), t('Curated', false, 0)], 0, S).products).toBe('handmade products'); // an unused type is not mentioned
  });
  it('claims nothing while any product has no type, or when nothing is published', () => {
    expect(describeCatalog([t('Handmade', true, 5)], 1, S)).toMatchObject({ adjective: '', products: 'products', finds: 'finds' });
    expect(describeCatalog([], 0, S).products).toBe('products');
  });
  it('offers the handmade filter only when a handmade type has products', () => {
    expect(describeCatalog([t('Handmade', true, 5)], 0, S).handmadeType).toBe('Handmade');
    expect(describeCatalog([t('Curated', false, 2)], 0, S)).not.toHaveProperty('handmadeType');
    expect(describeCatalog([t('Artisan made', true, 1)], 0, S).handmadeType).toBe('Artisan made'); // any admin-named type that counts as handmade
  });
  it('joins words and builds the site copy within the SEO limit', () => {
    expect(joinWords(['a'])).toBe('a'); expect(joinWords(['a', 'b'])).toBe('a and b'); expect(joinWords(['a', 'b', 'c'])).toBe('a, b and c');
    expect(capitalize('handmade products')).toBe('Handmade products');
    const longest = siteCopy(describeCatalog([t('Handmade', true, 1), t('Curated', false, 1), t('Resold', false, 1)], 0, S));
    expect(longest.tagline).toBe('Handmade, curated and resold products from Indian artisans');
    expect(longest.description.length).toBeLessThanOrEqual(160);
    expect(siteCopy(describeCatalog([], 0, S)).description).toMatch(/^Discover products from/);
  });
});

describe('loadCatalogWording (database)', () => {
  beforeEach(async () => { await resetTestDb(); });
  it('follows the catalogue: handmade only, then a curated product joins, then an untyped one removes every claim', async () => {
    const db = await getTestDb();
    const [{ id: pid }] = await db.select({ id: products.id }).from(products).limit(1);
    const typeId = async (name: string) => (await db.select().from(sourcingTypes).where(eq(sourcingTypes.name, name)))[0].id;
    expect((await loadCatalogWording()).products).toBe('handmade products');
    await db.update(products).set({ sourcingTypeId: await typeId('Curated') }).where(eq(products.id, pid));
    const mixed = await loadCatalogWording();
    expect(mixed.products).toBe('handmade and curated products');
    expect(mixed.handmadeType).toBe('Handmade');
    await db.update(products).set({ sourcingTypeId: null }).where(eq(products.id, pid));
    expect((await loadCatalogWording()).products).toBe('products');
    const { stats } = await loadCatalogWording();
    expect(stats.products).toBeGreaterThan(0); expect(stats.makers).toBeGreaterThan(0); expect(stats.cities).toBeGreaterThan(0);
  });
});
