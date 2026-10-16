import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { POST as postProduct } from '@/app/api/products/route';
import { PATCH as patchProduct, DELETE as deleteProductRoute } from '@/app/api/products/[id]/route';
import { POST as postWorkshop } from '@/app/api/workshops/route';
import { PATCH as patchWorkshop, DELETE as deleteWorkshopRoute } from '@/app/api/workshops/[id]/route';
import { resetTestDb, snapshot as readDb } from './helpers/testdb';

const asCustomer = () => authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (method: string, body: unknown) => new Request('http://x/api/x', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const product = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set.', stock: 3 };
const workshop = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, city: 'Jodhpur', venue: 'Studio 9', date: '2026-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn.' };

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue(null);
  await resetTestDb();
});

const calls = () => [
  () => postProduct(req('POST', product)),
  () => patchProduct(req('PATCH', { stock: 1 }), ctx('p1')),
  () => deleteProductRoute(req('DELETE', {}), ctx('p1')),
  () => postWorkshop(req('POST', workshop)),
  () => patchWorkshop(req('PATCH', { seats: 9 }), ctx('w1')),
  () => deleteWorkshopRoute(req('DELETE', {}), ctx('w1')),
];

describe('admin-only write APIs', () => {
  it('401 anonymous and nothing changes', async () => {
    for (const c of calls()) {
      const r = await c();
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'Authentication required.' });
    }
    const db = await readDb();
    expect(db.products).toHaveLength(4);
    expect(db.workshops).toHaveLength(3);
  });
  it('403 for customers and nothing changes', async () => {
    asCustomer();
    for (const c of calls()) {
      const r = await c();
      expect(r.status).toBe(403);
      expect((await r.json()).error).toMatch(/^(Seller or admin|Admin) access required\.$/);
    }
    const db = await readDb();
    expect(db.products).toHaveLength(4);
    expect(db.workshops).toHaveLength(3);
    expect(db.products[0].stock).toBe(8);
  });
  it('admin can create, update, delete products', async () => {
    asAdmin();
    const created = await postProduct(req('POST', product));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await patchProduct(req('PATCH', { stock: 9 }), ctx(id))).status).toBe(200);
    expect((await deleteProductRoute(req('DELETE', {}), ctx(id))).status).toBe(200);
    expect((await patchProduct(req('PATCH', { stock: 9 }), ctx(id))).status).toBe(404);
  });
  it('admin can create, update, delete workshops', async () => {
    asAdmin();
    const created = await postWorkshop(req('POST', workshop));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await patchWorkshop(req('PATCH', { seats: 20 }), ctx(id))).status).toBe(200);
    expect((await deleteWorkshopRoute(req('DELETE', {}), ctx(id))).status).toBe(200);
  });
  it('admin gets 400 with a message on invalid input', async () => {
    asAdmin();
    const r = await postProduct(req('POST', { ...product, pricePaise: -5 }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/pricePaise/);
  });
});

describe('archive and unknown keys through the HTTP routes', () => {
  it('POST /api/products without a status creates a Draft, for admins too', async () => {
    asAdmin();
    const res = await postProduct(req('POST', product));
    expect((await res.json()).status).toBe('DRAFT');
  });
  it('POST /api/products ignores contact keys that moved to the seller profile and never stores them', async () => {
    asAdmin();
    const res = await postProduct(req('POST', { ...product, phone: '12345', instagram: 'x', artistName: 'Y', seller: 'Z' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).not.toHaveProperty('artistName');
    expect(body.seller).not.toBe('Z');
    expect(body).not.toHaveProperty('phone');
  });
  it('PATCH can archive and restore a product; workshops can be archived too but not given an unknown status', async () => {
    asAdmin();
    const a = await patchProduct(req('PATCH', { status: 'ARCHIVED' }), ctx('p1'));
    expect(a.status).toBe(200);
    expect((await a.json()).status).toBe('ARCHIVED');
    expect((await patchProduct(req('PATCH', { status: 'APPROVED' }), ctx('p1'))).status).toBe(200);
    expect((await patchWorkshop(req('PATCH', { status: 'ARCHIVED' }), ctx('w1'))).status).toBe(200);
    const w = await patchWorkshop(req('PATCH', { status: 'HACK' }), ctx('w2'));
    expect(w.status).toBe(400);
    expect((await w.json()).error).toBe('status must be one of: APPROVED, DRAFT, ARCHIVED.');
  });
  it('customers cannot archive', async () => {
    asCustomer();
    expect((await patchProduct(req('PATCH', { status: 'ARCHIVED' }), ctx('p1'))).status).toBe(403);
    expect((await readDb()).products[0].status).toBe('APPROVED');
  });
});
