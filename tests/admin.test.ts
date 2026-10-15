import { describe, it, expect, beforeEach } from 'vitest';
import { createProduct, updateProduct, deleteProduct, createWorkshop, updateWorkshop, deleteWorkshop } from '@/lib/admin';
import { eq } from 'drizzle-orm';
import { resetTestDb, getTestDb, snapshot as readDb } from './helpers/testdb';
import { products as productsTable } from '@/db/schema';

beforeEach(async () => {
  await resetTestDb();
});

const validProduct = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set lac bangle.', stock: 3 };
const validWorkshop = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, city: 'Jodhpur', venue: 'Studio 9', date: '2026-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.' };

describe('products admin', () => {
  it('creates with a fresh id, APPROVED status, persisted', async () => {
    const p = await createProduct(validProduct);
    expect(p.id).toBe('p5');
    expect(p.status).toBe('APPROVED');
    expect((await readDb()).products).toHaveLength(5);
  });
  it('ignores a client-supplied id on create (valid status is honoured)', async () => {
    const p = await createProduct({ ...validProduct, id: 'p1', status: 'DRAFT' });
    expect(p.id).toBe('p5');
    expect(p.status).toBe('DRAFT');
  });
  it('rejects an unknown status on create', async () => {
    await expect(createProduct({ ...validProduct, status: 'HACK' })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('status') });
    expect((await readDb()).products).toHaveLength(4);
  });
  it('rejects invalid fields with 400', async () => {
    for (const bad of [
      { ...validProduct, name: '' }, { ...validProduct, name: 'x'.repeat(201) },
      { ...validProduct, category: 'Nope' }, { ...validProduct, city: 'Mars' },
      { ...validProduct, pricePaise: -1 }, { ...validProduct, pricePaise: 1.5 }, { ...validProduct, pricePaise: '5' },
      { ...validProduct, stock: -1 }, { ...validProduct, stock: 1.2 }, null, 'str', [],
    ]) await expect(createProduct(bad)).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products).toHaveLength(4);
  });
  it('updates only allowed fields and keeps id', async () => {
    const p = await updateProduct('p1', { stock: 20, pricePaise: 90000, id: 'zzz' });
    expect(p).toMatchObject({ id: 'p1', stock: 20, pricePaise: 90000, name: 'Crochet Lily Bouquet' });
  });
  it('update validates and 404s', async () => {
    await expect(updateProduct('p1', { stock: -5 })).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct('nope', { stock: 1 })).rejects.toMatchObject({ status: 404 });
    expect((await readDb()).products[0].stock).toBe(8);
  });
  it('deletes, 404 when missing', async () => {
    await deleteProduct('p2');
    expect((await readDb()).products.map(p => p.id)).toEqual(['p1', 'p3', 'p4']);
    await expect(deleteProduct('p2')).rejects.toMatchObject({ status: 404 });
  });
  it('concurrent creates get unique ids', async () => {
    const r = await Promise.all(Array.from({ length: 10 }, () => createProduct(validProduct)));
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
      { ...validWorkshop, type: 'MAYBE' }, { ...validWorkshop, city: 'Mars' }, { ...validWorkshop, title: '' },
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
    const p = await createProduct({ ...validProduct, imageUrl: 'https://cdn.example.com/a b.jpg' });
    expect(p.imageUrl).toBe('https://cdn.example.com/a%20b.jpg');
  });
  it('rejects non-https, scripts, data URLs, junk, non-strings and >500 chars', async () => {
    for (const imageUrl of [
      'http://cdn.example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//cdn.example.com/a.jpg',
      '/relative.jpg', 'not a url', 42, 'https://x.example.com/' + 'a'.repeat(500),
    ]) {
      await expect(createProduct({ ...validProduct, imageUrl })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('imageUrl') });
    }
    expect((await readDb()).products).toHaveLength(4);
  });
  it('can be cleared with an empty string on update', async () => {
    await updateProduct('p1', { imageUrl: 'https://cdn.example.com/a.jpg' });
    expect((await readDb()).products[0].imageUrl).toBe('https://cdn.example.com/a.jpg');
    await updateProduct('p1', { imageUrl: '' });
    expect((await readDb()).products[0].imageUrl).toBeUndefined();
  });
});

describe('ids are never reused', () => {
  it('a deleted highest product id is not handed out again', async () => {
    const a = await createProduct(validProduct);
    expect(a.id).toBe('p5');
    await deleteProduct('p5');
    const b = await createProduct(validProduct);
    expect(b.id).toBe('p6');
  });
  it('same for workshops', async () => {
    const a = await createWorkshop(validWorkshop);
    expect(a.id).toBe('w4');
    await deleteWorkshop('w4');
    expect((await createWorkshop(validWorkshop)).id).toBe('w5');
  });
  it('continues the sequence from existing ids when seeded without counters', async () => {
    expect((await createProduct(validProduct)).id).toBe('p5');
  });
});

describe('imageUrl credentials', () => {
  it('rejects URLs with embedded user/password (they would be published to every visitor)', async () => {
    for (const imageUrl of ['https://user:pass@cdn.example.com/a.jpg', 'https://user@cdn.example.com/a.jpg', 'https://:pw@cdn.example.com/a.jpg']) {
      await expect(createProduct({ ...validProduct, imageUrl })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('imageUrl') });
    }
  });
});

describe('clearing optional product fields writes NULL and never leaks null into JSON', () => {
  it('PATCH with empty/blank strings clears the columns', async () => {
    await updateProduct('p1', { instagram: 'shaukandstuff', phone: '9997979999', imageUrl: 'https://cdn.example.com/a.jpg' });
    const p = await updateProduct('p1', { instagram: '', phone: '   ', imageUrl: '' });
    expect('instagram' in p).toBe(false);
    expect('phone' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('null');
    const db = await getTestDb();
    const [row] = await db.select().from(productsTable).where(eq(productsTable.id, 'p1'));
    expect(row.instagram).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.imageUrl).toBeNull();
  });
  it('failed validation leaves the row untouched', async () => {
    await expect(updateProduct('p1', { stock: -3 })).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products[0].stock).toBe(8);
  });
});

describe('phone validation', () => {
  it('accepts Indian mobile numbers, with optional +91/91/0 prefix and spaces or hyphens, stored compact', async () => {
    for (const [input, stored] of [['9989898999', '9989898999'], ['+91 99898 98999', '+919989898999'], ['91-9989898999', '919989898999'], ['09989898999', '09989898999'], [' 6000000000 ', '6000000000']]) {
      const p = await updateProduct('p1', { phone: input });
      expect(p.phone).toBe(stored);
    }
  });
  it('rejects malformed phone numbers with 400 and leaves the row untouched', async () => {
    for (const phone of ['12345', '5989898999', '99898989', '99898989990', 'abcdefghij', '+1 9989898999', '9989898999; drop', '99898 989 9x']) {
      await expect(updateProduct('p1', { phone })).rejects.toMatchObject({ status: 400, message: expect.stringContaining('phone') });
      await expect(createProduct({ ...validProduct, phone })).rejects.toMatchObject({ status: 400 });
    }
    expect((await readDb()).products[0].phone).toBeUndefined();
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
    expect((await updateProduct('p1', { status: 'ARCHIVED' })).status).toBe('ARCHIVED');
    expect((await listProducts()).map(p => p.id)).not.toContain('p1');
    expect(await getProductBySlug('crochet-lily-bouquet-p1')).toBeUndefined();
    expect((await updateProduct('p1', { status: 'APPROVED' })).status).toBe('APPROVED');
    expect((await listProducts()).map(p => p.id)).toContain('p1');
  });
  it('archived products cannot be ordered', async () => {
    const { createOrder } = await import('@/lib/orders');
    await updateProduct('p1', { status: 'ARCHIVED' });
    await expect(createOrder({ items: [{ productId: 'p1', quantity: 1 }] }, 'a@b.co')).rejects.toMatchObject({ status: 400 });
  });
  it('workshops do not accept ARCHIVED; unknown product statuses are rejected', async () => {
    await expect(updateWorkshop('w1', { status: 'ARCHIVED' })).rejects.toMatchObject({ status: 400 });
    await expect(updateProduct('p1', { status: 'HACK' })).rejects.toMatchObject({ status: 400 });
  });
  it('artist counts split published, drafts and archived', async () => {
    const { listArtists } = await import('@/lib/admin-posts');
    await updateProduct('p1', { status: 'ARCHIVED' });
    await updateProduct('p3', { status: 'DRAFT' });
    const a = await listArtists();
    const totals = a.reduce((s, x) => ({ t: s.t + x.total, p: s.p + x.published, d: s.d + x.drafts, r: s.r + (x.archived ?? 0) }), { t: 0, p: 0, d: 0, r: 0 });
    expect(totals).toEqual({ t: 4, p: 2, d: 1, r: 1 });
  });
});
