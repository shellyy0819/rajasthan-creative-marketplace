import { describe, it, expect, beforeEach } from 'vitest';
import { createProduct, updateProduct, deleteProduct, createWorkshop, updateWorkshop, deleteWorkshop } from '@/lib/admin';
import { eq } from 'drizzle-orm';
import { makeSeller, resetTestDb, getTestDb, snapshot as readDb } from './helpers/testdb';
import { cities, products as productsTable } from '@/db/schema';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';

beforeEach(async () => {
  await resetTestDb();
});

const validProduct = { name: 'Lac Bangle', category: 'Accessories', cityRef: cityRef('Jodhpur'), pricePaise: 12000, description: 'Hand-set lac bangle.', stock: 3 };
const validWorkshop = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2026-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.' };

describe('write path accepts only validated cities', () => {
  const cityCount = async () => (await (await getTestDb()).select().from(cities)).length;
  it('a valid cityRef for Kota creates the city and links the product', async () => {
    const before = await cityCount();
    const p = await createProduct({ ...validProduct, cityRef: cityRef('Kota') }, admin);
    expect(p).toMatchObject({ city: 'Kota', citySlug: 'kota' });
    expect(await cityCount()).toBe(before + 1);
  });
  it('a tampered cityRef returns 400 and creates no city', async () => {
    const before = await cityCount();
    await expect(createProduct({ ...validProduct, cityRef: cityRef('Kota') + 'x' }, admin)).rejects.toMatchObject({ status: 400 });
    expect(await cityCount()).toBe(before);
  });
  it('a free-text city string returns 400', async () => {
    await expect(createProduct({ ...validProduct, city: 'Jodhpur' }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(createProduct({ ...validProduct, cityRef: undefined, city: 'Jodhpur' }, admin)).rejects.toMatchObject({ status: 400 });
  });
  it('a product with no city is refused', async () => {
    await expect(createProduct({ ...validProduct, cityRef: undefined }, admin)).rejects.toMatchObject({ status: 400, message: 'city is required.' });
  });
  it('cityId of an existing city links it; an unknown one is 400', async () => {
    const [{ id }] = await (await getTestDb()).select().from(cities).where(eq(cities.name, 'Udaipur'));
    expect(await createProduct({ ...validProduct, cityRef: undefined, cityId: id }, admin)).toMatchObject({ city: 'Udaipur', cityId: id });
    await expect(createProduct({ ...validProduct, cityRef: undefined, cityId: 99999 }, admin)).rejects.toMatchObject({ status: 400, message: 'Unknown city.' });
  });
  it('editing a product without changing city keeps its cityId; a cityRef moves it', async () => {
    const p = await createProduct({ ...validProduct, cityRef: undefined, cityId: (await createProduct({ ...validProduct, cityRef: cityRef('Kota') }, admin)).cityId }, admin);
    expect((await updateProduct(p.id, { name: 'Renamed' }, admin)).cityId).toBe(p.cityId);
    expect((await updateProduct(p.id, { name: 'Renamed 2', cityId: p.cityId }, admin)).cityId).toBe(p.cityId);
    expect(await updateProduct(p.id, { cityRef: cityRef('Jaipur') }, admin)).toMatchObject({ city: 'Jaipur' });
  });
  it('a seller editing an approved product with the same cityId is not sent back to review', async () => {
    const s = await makeSeller('same@x.co', 'Same');
    const p = await createProduct({ ...validProduct, status: 'APPROVED', sellerId: s.id }, admin);
    const sellerActor = { email: 'same@x.co', role: 'seller' as const };
    expect((await updateProduct(p.id, { cityId: p.cityId }, sellerActor)).status).toBe('APPROVED');
    expect((await updateProduct(p.id, { cityRef: cityRef('Kota') }, sellerActor)).status).toBe('DRAFT');
  });
  it('workshops behave the same', async () => {
    const before = await cityCount();
    await expect(createWorkshop({ ...validWorkshop, cityRef: cityRef('Kota') + 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(createWorkshop({ ...validWorkshop, city: 'Jodhpur' })).rejects.toMatchObject({ status: 400 });
    await expect(createWorkshop({ ...validWorkshop, cityRef: undefined })).rejects.toMatchObject({ status: 400, message: 'city is required.' });
    expect(await cityCount()).toBe(before);
    const w = await createWorkshop({ ...validWorkshop, cityRef: cityRef('Kota') });
    expect(w).toMatchObject({ city: 'Kota', citySlug: 'kota' });
    expect((await updateWorkshop(w.id, { title: 'New title' })).cityId).toBe(w.cityId);
    expect(await updateWorkshop(w.id, { cityRef: cityRef('Jaipur') })).toMatchObject({ city: 'Jaipur' });
    await expect(updateWorkshop(w.id, { cityId: 99999 })).rejects.toMatchObject({ status: 400 });
  });
});

describe('products admin', () => {
  it('creates with a fresh id and DRAFT status by default (nothing is published unless an admin says so), persisted', async () => {
    const p = await createProduct(validProduct, admin);
    expect(p.id).toBe('p5');
    expect(p.status).toBe('DRAFT');
    expect((await readDb()).products).toHaveLength(5);
    expect((await createProduct({ ...validProduct, status: 'APPROVED' }, admin)).status).toBe('APPROVED'); // explicit publish still works
    const { listProducts } = await import('@/lib/catalog');
    expect((await listProducts()).map(x => x.id)).not.toContain('p5');
  });
  it('ignores a client-supplied id on create (valid status is honoured)', async () => {
    const p = await createProduct({ ...validProduct, id: 'p1', status: 'DRAFT' }, admin);
    expect(p.id).toBe('p5');
    expect(p.status).toBe('DRAFT');
  });
  it('rejects an unknown status on create', async () => {
    await expect(createProduct({ ...validProduct, status: 'HACK' }, admin)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('status') });
    expect((await readDb()).products).toHaveLength(4);
  });
  it('rejects invalid fields with 400', async () => {
    for (const bad of [
      { ...validProduct, name: '' }, { ...validProduct, name: 'x'.repeat(201) },
      { ...validProduct, category: 'Nope' }, { ...validProduct, cityRef: undefined }, { ...validProduct, cityRef: undefined, cityId: 99999 },
      { ...validProduct, pricePaise: -1 }, { ...validProduct, pricePaise: 1.5 }, { ...validProduct, pricePaise: '5' },
      { ...validProduct, stock: -1 }, { ...validProduct, stock: 1.2 }, null, 'str', [],
    ]) await expect(createProduct(bad, admin)).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products).toHaveLength(4);
  });
  it('updates only allowed fields and keeps id', async () => {
    const p = await updateProduct('p1', { stock: 20, pricePaise: 90000, id: 'zzz' }, admin);
    expect(p).toMatchObject({ id: 'p1', stock: 20, pricePaise: 90000, name: 'Crochet Lily Bouquet' });
  });
  it('update validates and 404s', async () => {
    await expect(updateProduct('p1', { stock: -5 }, admin)).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct('nope', { stock: 1 }, admin)).rejects.toMatchObject({ status: 404 });
    expect((await readDb()).products[0].stock).toBe(8);
  });
  it('deletes, 404 when missing', async () => {
    await deleteProduct('p2');
    expect((await readDb()).products.map(p => p.id)).toEqual(['p1', 'p3', 'p4']);
    await expect(deleteProduct('p2')).rejects.toMatchObject({ status: 404 });
  });
  it('concurrent creates get unique ids', async () => {
    const r = await Promise.all(Array.from({ length: 10 }, () => createProduct(validProduct, admin)));
    expect(new Set(r.map(p => p.id)).size).toBe(10);
  });
});

describe('workshops admin', () => {
  it('creates with fresh id, booked 0, APPROVED', async () => {
    const w = await createWorkshop(validWorkshop);
    expect(w).toMatchObject({ id: 'w4', booked: 0, status: 'APPROVED' });
  });
  it('ignores client-supplied booked on create', async () => {
    expect((await createWorkshop({ ...validWorkshop, booked: 7 })).booked).toBe(0);
  });
  it('FREE forces price 0; PAID needs price > 0', async () => {
    expect((await createWorkshop({ ...validWorkshop, type: 'FREE', pricePaise: 500 })).pricePaise).toBe(0);
    await expect(createWorkshop({ ...validWorkshop, type: 'PAID', pricePaise: 0 })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects bad date/time/seats/type/city', async () => {
    for (const bad of [
      { ...validWorkshop, date: '2026-13-40' }, { ...validWorkshop, date: '01/12/2026' },
      { ...validWorkshop, time: '25:00' }, { ...validWorkshop, time: '4pm' },
      { ...validWorkshop, seats: 0 }, { ...validWorkshop, seats: 1001 }, { ...validWorkshop, seats: 2.5 },
      { ...validWorkshop, type: 'MAYBE' }, { ...validWorkshop, cityRef: undefined }, { ...validWorkshop, title: '' },
    ]) await expect(createWorkshop(bad)).rejects.toMatchObject({ status: 400 });
  });
  it('seats cannot drop below booked; booked not editable', async () => {
    await expect(updateWorkshop('w1', { seats: 2 })).rejects.toMatchObject({ status: 400 }); // booked 3
    const w = await updateWorkshop('w1', { seats: 3, booked: 0 });
    expect(w).toMatchObject({ seats: 3, booked: 3 });
  });
  it('update 404 / delete', async () => {
    await expect(updateWorkshop('nope', { seats: 5 })).rejects.toMatchObject({ status: 404 });
    await deleteWorkshop('w3');
    expect((await readDb()).workshops.map(w => w.id)).toEqual(['w1', 'w2']);
    await expect(deleteWorkshop('w3')).rejects.toMatchObject({ status: 404 });
  });
  it('switching an existing workshop to FREE zeroes its price', async () => {
    expect(await updateWorkshop('w1', { type: 'FREE' })).toMatchObject({ type: 'FREE', pricePaise: 0 });
  });
});

describe('product imageUrl', () => {
  it('accepts https URLs and normalises them', async () => {
    const p = await createProduct({ ...validProduct, imageUrl: 'https://cdn.example.com/a b.jpg' }, admin);
    expect(p.imageUrl).toBe('https://cdn.example.com/a%20b.jpg');
  });
  it('rejects non-https, scripts, data URLs, junk, non-strings and >500 chars', async () => {
    for (const imageUrl of [
      'http://cdn.example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//cdn.example.com/a.jpg',
      '/relative.jpg', 'not a url', 42, 'https://x.example.com/' + 'a'.repeat(500),
    ]) {
      await expect(createProduct({ ...validProduct, imageUrl }, admin)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('imageUrl') });
    }
    expect((await readDb()).products).toHaveLength(4);
  });
  it('can be cleared with an empty string on update', async () => {
    await updateProduct('p1', { imageUrl: 'https://cdn.example.com/a.jpg' }, admin);
    expect((await readDb()).products[0].imageUrl).toBe('https://cdn.example.com/a.jpg');
    await updateProduct('p1', { imageUrl: '' }, admin);
    expect((await readDb()).products[0].imageUrl).toBeUndefined();
  });
});

describe('ids are never reused', () => {
  it('a deleted highest product id is not handed out again', async () => {
    const a = await createProduct(validProduct, admin);
    expect(a.id).toBe('p5');
    await deleteProduct('p5');
    const b = await createProduct(validProduct, admin);
    expect(b.id).toBe('p6');
  });
  it('same for workshops', async () => {
    const a = await createWorkshop(validWorkshop);
    expect(a.id).toBe('w4');
    await deleteWorkshop('w4');
    expect((await createWorkshop(validWorkshop)).id).toBe('w5');
  });
  it('continues the sequence from existing ids when seeded without counters', async () => {
    expect((await createProduct(validProduct, admin)).id).toBe('p5');
  });
});

describe('imageUrl credentials', () => {
  it('rejects URLs with embedded user/password (they would be published to every visitor)', async () => {
    for (const imageUrl of ['https://user:pass@cdn.example.com/a.jpg', 'https://user@cdn.example.com/a.jpg', 'https://:pw@cdn.example.com/a.jpg']) {
      await expect(createProduct({ ...validProduct, imageUrl }, admin)).rejects.toMatchObject({ status: 400, message: expect.stringContaining('imageUrl') });
    }
  });
});

describe('clearing optional product fields writes NULL and never leaks null into JSON', () => {
  it('PATCH with empty/blank strings clears the columns', async () => {
    await updateProduct('p1', { pickupLocation: 'Studio shelf 2', imageUrl: 'https://cdn.example.com/a.jpg' }, admin);
    const p = await updateProduct('p1', { pickupLocation: '   ', imageUrl: '' }, admin);
    expect('pickupLocation' in p).toBe(false);
    expect('imageUrl' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('null');
    const db = await getTestDb();
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, 'p1'));
    expect(row.pickupLocation).toBeNull();
    expect(row.imageUrl).toBeNull();
  });
  it('failed validation leaves the row untouched', async () => {
    await expect(updateProduct('p1', { stock: -3 }, admin)).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products[0].stock).toBe(8);
  });
});

describe('product workshop link and pickup location', () => {
  it('links a product to a workshop (many products per workshop), rejects unknown/malformed workshop ids', async () => {
    const a = await updateProduct('p1', { workshopId: 'w1' }, admin);
    const b = await updateProduct('p2', { workshopId: 'w1' }, admin);
    expect([a.workshopId, b.workshopId]).toEqual(['w1', 'w1']);
    await expect(updateProduct('p3', { workshopId: 'w99' }, admin)).rejects.toMatchObject({ status: 400, message: 'workshopId does not match a workshop.' });
    for (const workshopId of ['x1', 'w', 5, ['w1']]) await expect(updateProduct('p3', { workshopId }, admin)).rejects.toMatchObject({ status: 400 });
    expect((await updateProduct('p1', { workshopId: '' }, admin)).workshopId).toBeUndefined();
  });
  it('pickupLocation is admin/seller-facing text up to 200 chars', async () => {
    expect((await updateProduct('p1', { pickupLocation: ' Studio shelf 2 ' }, admin)).pickupLocation).toBe('Studio shelf 2');
    await expect(updateProduct('p1', { pickupLocation: 'x'.repeat(201) }, admin)).rejects.toMatchObject({ status: 400 });
  });
  it('pickupLocation never reaches the public catalog', async () => {
    const { listProducts } = await import('@/lib/catalog');
    await updateProduct('p1', { pickupLocation: 'Secret shelf' }, admin);
    expect(JSON.stringify(await listProducts())).not.toContain('Secret shelf');
  });
});

describe('phone: HTML pattern and server regex agree', () => {
  it('same verdict on sample inputs', async () => {
    const { PHONE_PATTERN, normalizePhone } = await import('@/lib/phone');
    const html = new RegExp(`^(?:${PHONE_PATTERN})$`);
    for (const v of ['9989898999', '+91 99898 98999', '91-9989898999', '09989898999', '12345', '5989898999', '99898989990', '+1 9989898999', 'abcdefghij', '99898 989 9x'])
      expect(html.test(v)).toBe(normalizePhone(v) !== undefined);
  });
});

describe('ARCHIVED status', () => {
  it('products can be archived and restored; archived posts are hidden from the public catalog', async () => {
    const { listProducts, getProductBySlug } = await import('@/lib/catalog');
    expect((await updateProduct('p1', { status: 'ARCHIVED' }, admin)).status).toBe('ARCHIVED');
    expect((await listProducts()).map(p => p.id)).not.toContain('p1');
    expect(await getProductBySlug('crochet-lily-bouquet-p1')).toBeUndefined();
    expect((await updateProduct('p1', { status: 'APPROVED' }, admin)).status).toBe('APPROVED');
    expect((await listProducts()).map(p => p.id)).toContain('p1');
  });
  it('archived products cannot be ordered', async () => {
    const { createOrder } = await import('@/lib/orders');
    await updateProduct('p1', { status: 'ARCHIVED' }, admin);
    await expect(createOrder({ items: [{ productId: 'p1', quantity: 1 }] }, 'a@b.co')).rejects.toMatchObject({ status: 400 });
  });
  it('workshops can be archived too and are then hidden from the public list; unknown statuses are rejected', async () => {
    const { listWorkshops } = await import('@/lib/catalog');
    expect((await updateWorkshop('w1', { status: 'ARCHIVED' })).status).toBe('ARCHIVED');
    expect((await listWorkshops()).map(w => w.id)).not.toContain('w1');
    await expect(updateWorkshop('w2', { status: 'HACK' })).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct('p1', { status: 'HACK' }, admin)).rejects.toMatchObject({ status: 400 });
  });
  it('artist counts split published, drafts and archived', async () => {
    const { listArtists } = await import('@/lib/admin-posts');
    await updateProduct('p1', { status: 'ARCHIVED' }, admin);
    await updateProduct('p3', { status: 'DRAFT' }, admin);
    const a = await listArtists();
    const totals = a.reduce((s, x) => ({ t: s.t + x.total, p: s.p + x.published, d: s.d + x.drafts, r: s.r + (x.archived ?? 0) }), { t: 0, p: 0, d: 0, r: 0 });
    expect(totals).toEqual({ t: 4, p: 2, d: 1, r: 1 });
  });
});
