import { describe, it, expect, beforeEach, vi } from 'vitest';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

import { PATCH } from '@/app/api/products/[id]/stock/route';
import { createProduct, setProductStock, updateProduct } from '@/lib/admin';
import { getProductForAdmin } from '@/lib/admin-posts';
import { admin } from './helpers/actors';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const base = { name: 'Lac Bangle', category: 'Accessories', cityRef: cityRef('Jodhpur'), pricePaise: 12000, description: 'Hand-set.', stock: 3 };
let A: Awaited<ReturnType<typeof makeSeller>>;
let B: Awaited<ReturnType<typeof makeSeller>>;
beforeEach(async () => { await resetTestDb(); A = await makeSeller('alpha@x.co', 'Alpha Artist'); B = await makeSeller('beta@x.co', 'Beta Artist'); authMock.mockReset(); authMock.mockResolvedValue(null); });
const live = (sellerId: string) => createProduct({ ...base, sellerId, status: 'APPROVED' }, admin);   // an admin publishes a product for a seller

describe('setProductStock', () => {
  it('lets a seller change the stock of their own published product at once, and it stays published', async () => {
    const p = await live(A.id);
    const r = await setProductStock(p.id, { stock: 9 }, A.actor);
    expect(r).toMatchObject({ stock: 9, status: 'APPROVED' });
    expect((await getProductForAdmin(p.id)).status).toBe('APPROVED');
  });
  it('0 is sold out, still published, and it can come back', async () => {
    const p = await live(A.id);
    expect(await setProductStock(p.id, { stock: 0 }, A.actor)).toMatchObject({ stock: 0, status: 'APPROVED' });
    expect(await setProductStock(p.id, { stock: 4 }, A.actor)).toMatchObject({ stock: 4, status: 'APPROVED' });
  });
  it('works on drafts and archived products without changing their status', async () => {
    const d = await createProduct(base, A.actor), x = await createProduct({ ...base, status: 'ARCHIVED' }, A.actor);
    expect(await setProductStock(d.id, { stock: 7 }, A.actor)).toMatchObject({ stock: 7, status: 'DRAFT' });
    expect(await setProductStock(x.id, { stock: 2 }, A.actor)).toMatchObject({ stock: 2, status: 'ARCHIVED' });
  });
  it('lets an admin change anyone\'s product', async () => {
    const p = await live(A.id);
    expect(await setProductStock(p.id, { stock: 11 }, admin)).toMatchObject({ stock: 11, status: 'APPROVED' });
  });
  it('hides other sellers\' products behind a 404 and changes nothing', async () => {
    const p = await live(A.id);
    await expect(setProductStock(p.id, { stock: 1 }, B.actor)).rejects.toMatchObject({ status: 404 });
    expect((await getProductForAdmin(p.id)).stock).toBe(3);
    await expect(setProductStock('00000000-0000-4000-8000-000000000000', { stock: 1 }, A.actor)).rejects.toMatchObject({ status: 404 });
  });
  it('only takes a whole number from 0 to 100000', async () => {
    const p = await live(A.id);
    for (const stock of [-1, 100_001, 1.5, '3', null, undefined, NaN]) await expect(setProductStock(p.id, { stock }, A.actor)).rejects.toMatchObject({ status: 400 });
    await expect(setProductStock(p.id, {}, A.actor)).rejects.toMatchObject({ status: 400 });
    expect((await getProductForAdmin(p.id)).stock).toBe(3);
  });
});

describe('stock in the full edit form', () => {
  it('no longer sends a seller\'s live listing back to review, while any other change still does', async () => {
    const p = await live(A.id);
    expect((await updateProduct(p.id, { stock: 8 }, A.actor)).status).toBe('APPROVED');
    expect((await updateProduct(p.id, { stock: 8, description: 'Changed words.' }, A.actor)).status).toBe('DRAFT');
  });
});

describe('PATCH /api/products/[id]/stock', () => {
  const call = (id: string, body: unknown) => PATCH(new Request('http://x/api', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  const as = (email: string, role: string) => authMock.mockResolvedValue({ user: { email, role } });
  it('needs a seller or an admin', async () => {
    const p = await live(A.id);
    expect((await call(p.id, { stock: 5 })).status).toBe(401);
    as('c@x.co', 'customer'); expect((await call(p.id, { stock: 5 })).status).toBe(403);
    expect((await getProductForAdmin(p.id)).stock).toBe(3);
  });
  it('saves for the owner and answers with the product, 400 for a bad number, 404 for someone else\'s', async () => {
    const p = await live(A.id);
    as('alpha@x.co', 'seller');
    const ok = await call(p.id, { stock: 12 }); expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ id: p.id, stock: 12, status: 'APPROVED' });
    const bad = await call(p.id, { stock: -4 }); expect(bad.status).toBe(400); expect(((await bad.json()) as { error: string }).error).toMatch(/stock/);
    as('beta@x.co', 'seller'); expect((await call(p.id, { stock: 1 })).status).toBe(404);
    expect((await getProductForAdmin(p.id)).stock).toBe(12);
  });
});
