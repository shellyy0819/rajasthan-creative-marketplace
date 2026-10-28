import { describe, it, expect, beforeEach } from 'vitest';
import { createCategory, listCategories } from '@/lib/categories';
import { createProduct, updateProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import { admin } from './helpers/actors';
import { categories } from '@/db/schema';
import { cityRef } from './helpers/cities';

beforeEach(async () => { await resetTestDb(); });
const base = { name: 'Thing', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'D', stock: 1 };

describe('categories', () => {
  it('starts with the four original categories in order', async () => {
    expect(await listCategories()).toEqual(['Crochet & Textiles', 'Accessories', 'Resin Art', 'Pottery']);
  });
  it('creates a new category (trimmed, spaces collapsed) and lists it last', async () => {
    expect(await createCategory({ name: '  Wooden   Toys ' }, admin.email)).toEqual({ name: 'Wooden Toys', created: true });
    expect((await listCategories()).at(-1)).toBe('Wooden Toys');
  });
  it('an existing name (any case/spacing) is not duplicated: the stored spelling is returned with created=false', async () => {
    expect(await createCategory({ name: 'resin   ART' }, admin.email)).toEqual({ name: 'Resin Art', created: false });
    expect(await listCategories()).toHaveLength(4);
  });
  it('accepts normal punctuation and non-English letters; rejects junk, markup, control characters and bad lengths', async () => {
    for (const name of ['Block-print & Dye', "Women's Wear", 'Brass (Antique)', 'ज्वेलरी', 'Stone/Marble', 'A1']) await expect(createCategory({ name }, admin.email)).resolves.toMatchObject({ created: true });
    for (const name of ['', ' ', 'A', 'x'.repeat(41), '<script>alert(1)</script>', 'Tab\there', '12345', '!!!', 5, null, undefined, ['Pottery']])
      await expect(createCategory({ name }, admin.email)).rejects.toMatchObject({ status: 400 });
    await expect(createCategory(null, admin.email)).rejects.toMatchObject({ status: 400 });
  });
  it('is capped at 100 categories so the list cannot be flooded', async () => {
    const db = await getTestDb();
    await db.insert(categories).values(Array.from({ length: 96 }, (_, i) => ({ name: `Filler ${String.fromCharCode(97 + (i % 26))}${i}` })));
    expect(await listCategories()).toHaveLength(100);
    await expect(createCategory({ name: 'One Too Many' }, admin.email)).rejects.toMatchObject({ status: 409 });
    expect(await createCategory({ name: 'pottery' }, admin.email)).toMatchObject({ created: false }); // existing still fine
  });
  it('concurrent creates of the same name produce one row', async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => createCategory({ name: 'Brass Ware' }, admin.email)));
    expect(rs.filter(r => r.created)).toHaveLength(1);
    expect((await listCategories()).filter(c => c === 'Brass Ware')).toHaveLength(1);
  });
});

describe('products use categories from the table', () => {
  it('a product can use a newly created category and shows up in the public catalog', async () => {
    await createCategory({ name: 'Wooden Toys' }, admin.email);
    const s = await makeSeller('w@x.co', 'W');
    const p = await createProduct({ ...base, category: 'Wooden Toys', status: 'APPROVED', sellerId: s.id }, admin);
    expect(p.category).toBe('Wooden Toys');
    expect((await listProducts({ category: 'Wooden Toys' })).map(x => x.id)).toEqual([p.id]);
  });
  it('the category is matched ignoring case and stored with its canonical spelling', async () => {
    const p = await createProduct({ ...base, category: 'resin art' }, admin);
    expect(p.category).toBe('Resin Art');
    expect((await updateProduct(p.id, { category: 'POTTERY' }, admin)).category).toBe('Pottery');
  });
  it('an unknown category is a 400 that tells the user to create it first; nothing is written', async () => {
    await expect(createProduct({ ...base, category: 'Nope' }, admin)).rejects.toMatchObject({ status: 400, message: 'category must be an existing category. Create it first.' });
    await expect(updateProduct('p1', { category: 'Nope' }, admin)).rejects.toMatchObject({ status: 400 });
    for (const category of [undefined, '', 5, null, ['Pottery']]) await expect(createProduct({ ...base, category }, admin)).rejects.toMatchObject({ status: 400 });
    expect((await listProducts({ category: 'Crochet & Textiles' })).map(p => p.id)).toEqual(['p1']);
  });
  it('the database refuses a product with a category that is not in the table', async () => {
    const { products } = await import('@/db/schema');
    const db = await getTestDb();
    const s = await makeSeller('fk@x.co', 'FK');
    await expect(db.insert(products).values({ id: 'px', sellerId: s.id, name: 'N', category: 'Ghost', cityId: (await db.select().from((await import('@/db/schema')).cities).limit(1))[0].id, pricePaise: 1, description: 'D', stock: 1, status: 'DRAFT' })).rejects.toThrow();
  });
});
