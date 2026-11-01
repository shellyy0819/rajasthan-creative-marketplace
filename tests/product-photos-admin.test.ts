import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/storage', async importActual => ({ ...(await importActual<typeof import('@/lib/storage')>()), deleteObjects: vi.fn(async () => undefined) }));
import { deleteObjects } from '@/lib/storage';
import { createProduct, deleteProduct, updateProduct } from '@/lib/admin';
import { listProducts } from '@/lib/catalog';
import { productImages } from '@/db/schema';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

const BASE = 'https://b.s3.ap-south-1.amazonaws.com';
const img = (id: string, n = 'a.jpg') => `${BASE}/products/${id}/${n}`;
const valid = { name: 'Lac Bangle', category: 'Accessories', cityRef: cityRef('Jodhpur'), pricePaise: 12000, description: 'Hand-set lac bangle.', stock: 3 };
const spy = vi.mocked(deleteObjects);
const ENV = { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'AKIAFAKE', AWS_SECRET_ACCESS_KEY: 'secret' };
let saved: Record<string, string | undefined>;

beforeEach(async () => {
  saved = Object.fromEntries(Object.keys(ENV).map(k => [k, process.env[k]]));
  Object.assign(process.env, ENV);
  spy.mockClear(); spy.mockImplementation(async () => undefined);
  await resetTestDb();
});
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
const productCount = async () => (await listProducts()).length;
const rows = async (id: string) => (await (await getTestDb()).select().from(productImages).where(eq(productImages.productId, id))).sort((a, b) => a.position - b.position);

describe('creating a product with photos', () => {
  it('stores the ordered list; the cover is the first; an admin may use any seller folder', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const p = await createProduct({ ...valid, images: [img(s.id, 'a.jpg'), img('11111111-1111-4111-8111-111111111111', 'b.png')] }, admin);
    expect(p.images).toEqual([img(s.id, 'a.jpg'), img('11111111-1111-4111-8111-111111111111', 'b.png')]);
    expect(p.imageUrl).toBe(img(s.id, 'a.jpg'));
    expect((await rows(p.id)).map(r => r.s3Key)).toEqual([`products/${s.id}/a.jpg`, 'products/11111111-1111-4111-8111-111111111111/b.png']);
  });
  it('a seller can attach their own files only', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const p = await createProduct({ ...valid, images: [img(s.id)] }, s.actor);
    expect(p.images).toEqual([img(s.id)]);
  });
  it('refuses another seller’s file, an outside link, 7 photos, duplicates and non-lists, and creates nothing', async () => {
    const s = await makeSeller('s@x.co', 'S'); const o = await makeSeller('o@x.co', 'O');
    const before = await productCount();
    for (const images of [[img(o.id)], ['https://cdn.example.com/a.jpg'], Array.from({ length: 7 }, (_, i) => img(s.id, `${i}.jpg`)), [img(s.id), img(s.id)], 'x', [''], [5]])
      await expect(createProduct({ ...valid, images }, s.actor), JSON.stringify(images)).rejects.toMatchObject({ status: 400 });
    expect(await productCount()).toBe(before);
  });
  it('the retired imageUrl input is ignored', async () => {
    const p = await createProduct({ ...valid, imageUrl: 'https://cdn.example.com/a.jpg' }, admin);
    expect(p).not.toHaveProperty('imageUrl'); expect(p).not.toHaveProperty('images');
  });
});

describe('updating photos', () => {
  const make = async (s: { id: string; actor: typeof admin }, n = 3) =>
    createProduct({ ...valid, images: Array.from({ length: n }, (_, i) => img(s.id, `${i}.jpg`)) }, s.actor);

  it('omitting images keeps the photos; [] removes them all and hands the stored keys to S3 delete', async () => {
    const s = await makeSeller('s@x.co', 'S'); const p = await make(s, 2);
    expect((await updateProduct(p.id, { name: 'New name' }, s.actor)).images).toHaveLength(2);
    expect(spy).not.toHaveBeenCalled();
    const cleared = await updateProduct(p.id, { images: [] }, s.actor);
    expect(cleared).not.toHaveProperty('images'); expect(cleared).not.toHaveProperty('imageUrl');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].sort()).toEqual([`products/${s.id}/0.jpg`, `products/${s.id}/1.jpg`]);
  });
  it('reordering changes the cover and deletes nothing; dropping one deletes only that object', async () => {
    const s = await makeSeller('s@x.co', 'S'); const p = await make(s, 3);
    const re = await updateProduct(p.id, { images: [img(s.id, '2.jpg'), img(s.id, '0.jpg'), img(s.id, '1.jpg')] }, s.actor);
    expect(re.imageUrl).toBe(img(s.id, '2.jpg'));
    expect(spy).not.toHaveBeenCalled();
    await updateProduct(p.id, { images: [img(s.id, '2.jpg'), img(s.id, '1.jpg')] }, s.actor);
    expect(spy.mock.calls[0][1]).toEqual([`products/${s.id}/0.jpg`]);
  });
  it('a list that would exceed 6, or contains a foreign file, is a 400 and the old photos stay', async () => {
    const s = await makeSeller('s@x.co', 'S'); const o = await makeSeller('o@x.co', 'O'); const p = await make(s, 3);
    await expect(updateProduct(p.id, { images: Array.from({ length: 7 }, (_, i) => img(s.id, `n${i}.jpg`)) }, s.actor)).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct(p.id, { images: [img(s.id, '0.jpg'), img(o.id)] }, s.actor)).rejects.toMatchObject({ status: 400 });
    expect((await rows(p.id)).map(r => r.url)).toEqual([0, 1, 2].map(i => img(s.id, `${i}.jpg`)));
    expect(spy).not.toHaveBeenCalled();
  });
  it('a seller cannot touch the photos of someone else’s product (404 as for any edit)', async () => {
    const s = await makeSeller('s@x.co', 'S'); const o = await makeSeller('o@x.co', 'O'); const p = await make(o, 1);
    await expect(updateProduct(p.id, { images: [img(s.id)] }, s.actor)).rejects.toMatchObject({ status: 404 });
  });
  it('a seller changing the photos of a published product sends it back to Draft; an unchanged list does not; an admin does not', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const pub = await createProduct({ ...valid, status: 'APPROVED', sellerId: s.id, images: [img(s.id, 'a.jpg'), img(s.id, 'b.jpg')] }, admin);
    expect(pub.status).toBe('APPROVED');
    expect((await updateProduct(pub.id, { images: [img(s.id, 'a.jpg'), img(s.id, 'b.jpg')] }, s.actor)).status).toBe('APPROVED');
    expect((await updateProduct(pub.id, { images: [img(s.id, 'b.jpg'), img(s.id, 'a.jpg')] }, admin)).status).toBe('APPROVED');
    expect((await updateProduct(pub.id, { images: [img(s.id, 'a.jpg'), img(s.id, 'b.jpg')] }, s.actor)).status).toBe('DRAFT'); // reorder back = cover changed
  });
  it('an S3 failure while saving never fails the save', async () => {
    const s = await makeSeller('s@x.co', 'S'); const p = await make(s, 2);
    spy.mockRejectedValue(new Error('AccessDenied'));
    const r = await updateProduct(p.id, { images: [img(s.id, '0.jpg')] }, s.actor);
    expect(r.images).toEqual([img(s.id, '0.jpg')]);
  });
});

describe('without storage configured', () => {
  it('already attached photos can be kept and reordered, new ones are refused, text edits work', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const p = await createProduct({ ...valid, images: [img(s.id, 'a.jpg'), img(s.id, 'b.jpg')] }, s.actor);
    for (const k of Object.keys(ENV)) delete process.env[k];
    expect((await updateProduct(p.id, { images: [img(s.id, 'b.jpg'), img(s.id, 'a.jpg')] }, s.actor)).imageUrl).toBe(img(s.id, 'b.jpg'));
    await expect(updateProduct(p.id, { images: [img(s.id, 'new.jpg')] }, s.actor)).rejects.toMatchObject({ status: 400 });
    expect((await updateProduct(p.id, { name: 'Renamed' }, s.actor)).name).toBe('Renamed');
    await expect(createProduct({ ...valid, images: [img(s.id, 'c.jpg')] }, s.actor)).rejects.toMatchObject({ status: 400 });
    expect((await createProduct(valid, s.actor)).id).toBeTruthy();
  });
});

describe('deleting a product', () => {
  it('hands its stored objects to S3 delete once (legacy links are skipped) and still succeeds if that fails', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const p = await createProduct({ ...valid, images: [img(s.id, 'a.jpg'), img(s.id, 'b.jpg')] }, s.actor);
    const db = await getTestDb();
    await db.insert(productImages).values({ productId: p.id, url: 'https://cdn.example.com/legacy.jpg', s3Key: null, position: 2 });
    spy.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(deleteProduct(p.id)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].sort()).toEqual([`products/${s.id}/a.jpg`, `products/${s.id}/b.jpg`]);
    expect(await rows(p.id)).toHaveLength(0);
  });
  it('a product without photos does not call S3', async () => {
    await deleteProduct('p1');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('a stored photo used by two products is only deleted when the last one lets go', () => {
  it('removing it from one product, or deleting one product, keeps the file while another product still shows it', async () => {
    const s = await makeSeller('s@x.co', 'S');
    const shared = img(s.id, 'shared.jpg');
    const a = await createProduct({ ...valid, images: [shared, img(s.id, 'only-a.jpg')] }, s.actor);
    const b = await createProduct({ ...valid, name: 'Second', images: [shared] }, s.actor);
    await updateProduct(a.id, { images: [img(s.id, 'only-a.jpg')] }, s.actor);              // a lets go, b still uses it
    expect(spy).not.toHaveBeenCalled();
    await deleteProduct(a.id);                                                              // only-a.jpg is unique to a
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toEqual([`products/${s.id}/only-a.jpg`]);
    spy.mockClear();
    const c = await createProduct({ ...valid, name: 'Third', images: [shared] }, s.actor);
    await deleteProduct(b.id);                                                              // c still uses shared.jpg
    expect(spy).not.toHaveBeenCalled();
    await updateProduct(c.id, { images: [] }, s.actor);                                     // the last user lets go
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toEqual([`products/${s.id}/shared.jpg`]);
  });
  it('an admin attaching a seller’s file to another product does not let a later removal delete the original', async () => {
    const s = await makeSeller('s@x.co', 'S'); const t = await makeSeller('t@x.co', 'T');
    const file = img(s.id, 'orig.jpg');
    await createProduct({ ...valid, images: [file] }, s.actor);
    const copy = await createProduct({ ...valid, name: 'Other', sellerId: t.id, images: [file] }, admin);
    await updateProduct(copy.id, { images: [] }, admin);
    expect(spy).not.toHaveBeenCalled();
  });
});
