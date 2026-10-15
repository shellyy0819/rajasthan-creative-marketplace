import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const asCustomer = (email = 'c@x.co') => authMock.mockResolvedValue({ user: { email, role: 'customer' } });
const asAdmin = () => authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });

import { GET as health } from '@/app/api/health/route';
import { GET as products } from '@/app/api/products/route';
import { GET as workshops } from '@/app/api/workshops/route';
import { POST as orders, GET as listOrdersRoute } from '@/app/api/orders/route';
import { POST as bookings, GET as listBookingsRoute } from '@/app/api/bookings/route';
import { GET as summary } from '@/app/api/admin/summary/route';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue(null);
  await resetTestDb();
});

const post = (url: string, body: string) =>
  new Request(`http://x${url}`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

describe('api', () => {
  it('health', async () => {
    const r = await health();
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });
  it('products filters by query string', async () => {
    const r = await products(new Request('http://x/api/products?city=Jaipur&q=blue'));
    expect((await r.json()).map((p: { id: string }) => p.id)).toEqual(['p4']);
  });
  it('workshops filters by type', async () => {
    const r = await workshops(new Request('http://x/api/workshops?type=FREE'));
    expect((await r.json())).toHaveLength(1);
  });
  it('POST /api/orders 201 then 400 on bad body', async () => {
    asCustomer();
    const ok = await orders(post('/api/orders', JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }] })));
    expect(ok.status).toBe(201);
    const bad = await orders(post('/api/orders', JSON.stringify({ items: [] })));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Add at least one item.' });
  });
  it('invalid JSON → 400', async () => {
    asCustomer();
    const r = await orders(post('/api/orders', '{nope'));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Invalid JSON' });
  });
  it('POST /api/bookings 201 / 404 / 409', async () => {
    asCustomer();
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'w3' })))).status).toBe(201);
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'x' })))).status).toBe(404);
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'w1', quantity: 50 })))).status).toBe(409);
  });
  it('summary counts', async () => {
    asAdmin();
    const j = await (await summary()).json();
    expect(j).toMatchObject({ products: 4, workshops: 3, orders: 0, bookings: 0 });
  });

  it('public GETs work without a session', async () => {
    expect((await health()).status).toBe(200);
    expect((await products(new Request('http://x/api/products'))).status).toBe(200);
    expect((await workshops(new Request('http://x/api/workshops'))).status).toBe(200);
  });
  it('orders and bookings require login → 401', async () => {
    const body = JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }], workshopId: 'w3' });
    for (const r of [await orders(post('/api/orders', body)), await bookings(post('/api/bookings', body)), await listOrdersRoute(), await listBookingsRoute()]) {
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'Authentication required.' });
    }
  });
  it('unauthenticated order does not touch stock', async () => {
    await orders(post('/api/orders', JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }] })));
    asAdmin();
    expect((await (await summary()).json()).orders).toBe(0);
  });
  it('order owner comes from the session, not the body', async () => {
    asCustomer('me@x.co');
    const r = await orders(post('/api/orders', JSON.stringify({ userEmail: 'evil@x.co', items: [{ productId: 'p2', quantity: 1 }] })));
    expect((await r.json()).userEmail).toBe('me@x.co');
  });
  it('customer lists only own orders', async () => {
    asCustomer('a@x.co');
    await orders(post('/api/orders', JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }] })));
    asCustomer('b@x.co');
    await orders(post('/api/orders', JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }] })));
    expect((await (await listOrdersRoute()).json())).toHaveLength(1);
    asAdmin();
    expect((await (await listOrdersRoute()).json())).toHaveLength(2);
  });
  it('admin summary: 401 anonymous, 403 customer, 200 admin', async () => {
    expect((await summary()).status).toBe(401);
    asCustomer();
    const r = await summary();
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'Admin access required.' });
    asAdmin();
    expect((await summary()).status).toBe(200);
  });
});
