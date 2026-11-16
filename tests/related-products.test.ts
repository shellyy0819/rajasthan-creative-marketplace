import { describe, it, expect, beforeEach } from 'vitest';
import { createProduct } from '@/lib/admin';
import { createCategory } from '@/lib/categories';
import { listProducts } from '@/lib/catalog';
import { getRelatedProducts } from '@/lib/related-products';
import { categories } from '@/db/schema';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

type Seller = Awaited<ReturnType<typeof makeSeller>>;
let a: Seller;
let b: Seller;

/** Creates an approved product and returns it as the public Product the page works with. */
async function add(seller: Seller, name: string, category: string, status = 'APPROVED') {
  const made = await createProduct({ name, category, cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status, sellerId: seller.id }, admin);
  return (await listProducts()).find(p => p.id === made.id) ?? ({ id: made.id } as never);
}
/** Only the products this test made (the seeded catalogue is ignored). */
const mine = (list: { name: string }[]) => list.map(p => p.name).filter(n => n.startsWith('T-'));

beforeEach(async () => {
  await resetTestDb();
  a = await makeSeller('a@x.co', 'Studio A');
  b = await makeSeller('b@x.co', 'Studio B');
  for (const name of ['Paintings', 'Oil Paintings', 'Pottery']) await createCategory({ name }, 'a@x.co');
  // The form never allows % in a name; a row added some other way must still be matched literally.
  await (await getTestDb()).insert(categories).values({ name: '%' });
});

describe('getRelatedProducts: more from the maker', () => {
  it("lists the maker's other products newest first, never the current one", async () => {
    const p1 = await add(a, 'T-A1', 'Paintings');
    await add(a, 'T-A2', 'Pottery');
    await add(a, 'T-A3', 'Paintings');
    expect(mine((await getRelatedProducts(p1)).fromMaker)).toEqual(['T-A3', 'T-A2']);
  });
  it('is capped at 4', async () => {
    const p1 = await add(a, 'T-A1', 'Pottery');
    for (let i = 2; i <= 7; i++) await add(a, `T-A${i}`, 'Pottery');
    expect((await getRelatedProducts(p1)).fromMaker).toHaveLength(4);
  });
  it('is empty when the maker has nothing else', async () => {
    const p1 = await add(a, 'T-A1', 'Pottery');
    await add(b, 'T-B1', 'Pottery');
    expect((await getRelatedProducts(p1)).fromMaker).toEqual([]);
  });
});

describe('getRelatedProducts: similar products', () => {
  it("puts matching categories first and leaves out the maker's own and the current product", async () => {
    const p1 = await add(a, 'T-A1', 'Paintings');
    await add(a, 'T-A2', 'Paintings');
    await add(b, 'T-B1', 'Oil Paintings');
    await add(b, 'T-B2', 'Pottery');
    await add(b, 'T-B3', 'Paintings');
    const { similar } = await getRelatedProducts(p1);
    expect(mine(similar)).toEqual(['T-B3', 'T-B1', 'T-B2']); // matches (newest first), then the fallback
  });
  it('matches ignoring case, in both directions', async () => {
    const oil = await add(a, 'T-A1', 'Oil Paintings');
    const plain = await add(a, 'T-A2', 'Paintings');
    await add(b, 'T-B1', 'Paintings');
    await add(b, 'T-B2', 'Oil Paintings');
    await add(b, 'T-B3', 'Pottery');
    // current "Oil Paintings" contains "Paintings" (and equals "Oil Paintings"); Pottery only as fallback
    expect(mine((await getRelatedProducts(oil)).similar)).toEqual(['T-B2', 'T-B1', 'T-B3']);
    // current "Paintings" is contained in "Oil Paintings" (different case in the middle of the name)
    expect(mine((await getRelatedProducts(plain)).similar)).toEqual(['T-B2', 'T-B1', 'T-B3']);
  });
  it('a category named "%" matches only itself, not everything', async () => {
    const p1 = await add(a, 'T-A1', '%');
    await add(b, 'T-B1', '%');
    await add(b, 'T-B2', 'Pottery'); // newer, so it would come first if "%" were a wildcard
    expect(mine((await getRelatedProducts(p1)).similar)).toEqual(['T-B1', 'T-B2']);
  });
  it('is capped at 8 and fills from other categories when matches run out', async () => {
    const p1 = await add(a, 'T-A1', 'Paintings');
    for (let i = 1; i <= 3; i++) await add(b, `T-M${i}`, 'Paintings');
    for (let i = 1; i <= 7; i++) await add(b, `T-O${i}`, 'Pottery');
    const { similar } = await getRelatedProducts(p1);
    expect(similar).toHaveLength(8);
    expect(similar.slice(0, 3).map(p => p.name).sort()).toEqual(['T-M1', 'T-M2', 'T-M3']);
  });
  it('never lists drafts', async () => {
    const p1 = await add(a, 'T-A1', 'Paintings');
    await add(b, 'T-B1', 'Paintings', 'DRAFT');
    expect(mine((await getRelatedProducts(p1)).similar)).toEqual([]);
  });
});
