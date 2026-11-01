import fs from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { loadImages, parseImages, resolveImages, saveImages, type ImageRef } from '@/lib/product-images';
import type { StorageConfig } from '@/lib/storage';
import { listProducts } from '@/lib/catalog';
import { productImages, products } from '@/db/schema';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';

const cfg: StorageConfig = { bucket: 'b', region: 'ap-south-1', publicBase: 'https://b.s3.ap-south-1.amazonaws.com', keyPrefix: '' };
const url = (userId: string, name = 'x.jpg') => `${cfg.publicBase}/products/${userId}/${name}`;
beforeEach(async () => { await resetTestDb(); });
const save = async (productId: string, refs: ImageRef[]) => { const db = await getTestDb(); return db.transaction(tx => saveImages(tx, productId, refs)); };
const ref = (u: string, key: string | null = u.replace(`${cfg.publicBase}/`, '')): ImageRef => ({ url: u, key });

describe('parseImages', () => {
  it('is undefined when the key is absent, an array otherwise, trimmed', () => {
    expect(parseImages(undefined)).toBeUndefined();
    expect(parseImages([])).toEqual([]);
    expect(parseImages(['  https://a.example/1.jpg  '])).toEqual(['https://a.example/1.jpg']);
  });
  it('rejects non-arrays, non-strings, blanks, more than 6 and duplicates with a 400', () => {
    const msg = /images must be a list of up to 6 image URLs\./;
    for (const bad of ['x', {}, null, 5, [5], [''], ['  '], Array.from({ length: 7 }, (_, i) => `https://a.example/${i}.jpg`), ['https://a.example/1.jpg', 'https://a.example/1.jpg']])
      expect(() => parseImages(bad), JSON.stringify(bad)).toThrow(expect.objectContaining({ status: 400, message: expect.stringMatching(msg) }));
    expect(parseImages(Array.from({ length: 6 }, (_, i) => `https://a.example/${i}.jpg`))).toHaveLength(6);
  });
});

describe('saveImages / loadImages / public JSON', () => {
  it('stores in order, reorders without removing anything, and reports removed keys', async () => {
    const [a, b, c] = ['a.jpg', 'b.jpg', 'c.jpg'].map(n => ref(url('U1', n)));
    expect((await save('p1', [a, b, c])).removedKeys).toEqual([]);
    expect((await loadImages(await getTestDb(), 'p1')).map(r => r.url)).toEqual([a.url, b.url, c.url]);
    expect((await save('p1', [c, a, b])).removedKeys).toEqual([]);
    expect((await loadImages(await getTestDb(), 'p1')).map(r => r.url)).toEqual([c.url, a.url, b.url]);
    expect((await save('p1', [c, b])).removedKeys).toEqual([a.key]);
    expect((await save('p1', [c, b])).removedKeys).toEqual([]);                       // identical list: no-op
  });
  it('legacy photos (no key) are never reported as removed', async () => {
    await save('p1', [{ url: 'https://cdn.example.com/old.jpg', key: null }, ref(url('U1', 'a.jpg'))]);
    expect((await save('p1', [])).removedKeys).toEqual(['products/U1/a.jpg']);
  });
  it('public product JSON has images in order and imageUrl = the cover; none → neither key (never null)', async () => {
    const [a, b] = [ref(url('U1', 'a.jpg')), ref(url('U1', 'b.jpg'))];
    await save('p1', [a, b]);
    const list = await listProducts();
    const p1 = list.find(p => p.id === 'p1')!, p2 = list.find(p => p.id === 'p2')!;
    expect(p1.images).toEqual([a.url, b.url]); expect(p1.imageUrl).toBe(a.url);
    expect(p2).not.toHaveProperty('images'); expect(p2).not.toHaveProperty('imageUrl');
    expect(JSON.stringify(p2)).not.toContain('null');
  });
  it('deleting a product removes its photo rows', async () => {
    await save('p1', [ref(url('U1', 'a.jpg'))]);
    const db = await getTestDb();
    await db.delete(products).where(eq(products.id, 'p1'));
    expect(await db.select().from(productImages)).toHaveLength(0);
  });
  it('two photos cannot share a position (unique per product)', async () => {
    await save('p1', [ref(url('U1', 'a.jpg'))]);
    const db = await getTestDb();
    await expect(db.insert(productImages).values({ productId: 'p1', url: 'https://x.example/y.jpg', position: 0 })).rejects.toThrow();
  });
});

describe('resolveImages', () => {
  const resolve = async (urls: string[], o: { userId: string; isAdmin?: boolean; productId?: string; cfg?: StorageConfig | null }) =>
    resolveImages(await getTestDb(), { urls, userId: o.userId, isAdmin: o.isAdmin ?? false, productId: o.productId, cfg: o.cfg === undefined ? cfg : o.cfg });

  it('a seller may attach files in their own folder and gets the object key back', async () => {
    const s = await makeSeller('s@x.co', 'S');
    expect(await resolve([url(s.id, 'a.jpg'), url(s.id, 'b.png')], { userId: s.id })).toEqual([
      { url: url(s.id, 'a.jpg'), key: `products/${s.id}/a.jpg` }, { url: url(s.id, 'b.png'), key: `products/${s.id}/b.png` },
    ]);
  });
  it('a seller is refused another seller’s folder, outside links, look-alike hosts, traversal, queries, http and scripts', async () => {
    const s = await makeSeller('s@x.co', 'S'); const other = await makeSeller('o@x.co', 'O');
    const base = cfg.publicBase;
    for (const bad of [
      url(other.id), 'https://cdn.example.com/a.jpg', `http://b.s3.ap-south-1.amazonaws.com/products/${s.id}/x.jpg`,
      `https://b.s3.ap-south-1.amazonaws.com.evil.com/products/${s.id}/x.jpg`, `${base}/products/${s.id}/../${other.id}/x.jpg`,
      `${base}/products/${s.id}/x.jpg?x=1`, `${base}/other/x.jpg`, 'javascript:alert(1)', `${base}/products/${s.id}x/x.jpg`, `${base}/products/${s.id.toUpperCase()}/x.jpg`,
    ]) await expect(resolve([bad], { userId: s.id }), bad).rejects.toMatchObject({ status: 400, message: 'One or more images are not allowed.' });
    await expect(resolve([url(s.id), url(other.id)], { userId: s.id })).rejects.toMatchObject({ status: 400 }); // one bad item fails the whole list
  });
  it('an admin may attach any seller folder in products/ but still not outside links or other paths', async () => {
    const a = await makeSeller('a@x.co', 'A'); const o = await makeSeller('o@x.co', 'O');
    expect(await resolve([url(o.id)], { userId: a.id, isAdmin: true })).toHaveLength(1);
    for (const bad of ['https://cdn.example.com/a.jpg', `${cfg.publicBase}/other/x.jpg`]) await expect(resolve([bad], { userId: a.id, isAdmin: true })).rejects.toMatchObject({ status: 400 });
  });
  it('urls already attached to this product are accepted, keep their stored key, and are rejected for another product', async () => {
    const s = await makeSeller('s@x.co', 'S');
    await save('p1', [{ url: 'https://cdn.example.com/legacy.jpg', key: null }, ref(url(s.id, 'a.jpg'))]);
    expect(await resolve(['https://cdn.example.com/legacy.jpg', url(s.id, 'a.jpg')], { userId: 'someone-else', productId: 'p1' })).toEqual([
      { url: 'https://cdn.example.com/legacy.jpg', key: null }, { url: url(s.id, 'a.jpg'), key: `products/${s.id}/a.jpg` },
    ]);
    await expect(resolve(['https://cdn.example.com/legacy.jpg'], { userId: s.id, productId: 'p2' })).rejects.toMatchObject({ status: 400 });
    await expect(resolve([url(s.id, 'a.jpg')], { userId: 'someone-else', productId: 'p2' })).rejects.toMatchObject({ status: 400 });
  });
  it('with no storage configured only already-attached urls pass', async () => {
    const s = await makeSeller('s@x.co', 'S');
    await save('p1', [ref(url(s.id, 'a.jpg'))]);
    expect(await resolve([url(s.id, 'a.jpg')], { userId: s.id, productId: 'p1', cfg: null })).toHaveLength(1);
    await expect(resolve([url(s.id, 'new.jpg')], { userId: s.id, productId: 'p1', cfg: null })).rejects.toMatchObject({ status: 400 });
    expect(await resolve([], { userId: s.id, cfg: null })).toEqual([]);
  });
});

describe('migration backfill', () => {
  it('copies each existing image_url into product_images at position 0 and skips products without one', async () => {
    const file = fs.readdirSync('drizzle').find(f => /product_images\.sql$/.test(f))!;
    const stmt = fs.readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint').find(s => /INSERT INTO "product_images"/i.test(s))!;
    expect(stmt).toBeTruthy();
    const db = await getTestDb();
    await db.delete(productImages);
    await db.execute(sql`update products set image_url = 'https://cdn.example.com/old.jpg' where id = 'p1'`);
    await db.execute(sql.raw(stmt));
    const rows = await db.select().from(productImages);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 'p1', url: 'https://cdn.example.com/old.jpg', position: 0, s3Key: null });
  });
});
