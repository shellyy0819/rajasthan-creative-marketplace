import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import { POST as postProduct } from '@/app/api/products/route';
import { PATCH as patchProduct, DELETE as deleteProductRoute } from '@/app/api/products/[id]/route';
import { POST as postWorkshop } from '@/app/api/workshops/route';
import { PATCH as patchWorkshop, DELETE as deleteWorkshopRoute } from '@/app/api/workshops/[id]/route';
import { readDb } from '@/lib/db';

const asCustomer = () => authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
const req = (method: string, body: unknown) => new Request('http://x/api/x', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const product = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, seller: 'Marwar Lac', description: 'Hand-set.', stock: 3 };
const workshop = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, city: 'Jodhpur', venue: 'Studio 9', date: '2026-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn.' };

beforeEach(() => {
  authMock.mockReset();
  authMock.mockResolvedValue(null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rradmapi-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
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
      expect(await r.json()).toEqual({ error: 'Admin access required.' });
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
