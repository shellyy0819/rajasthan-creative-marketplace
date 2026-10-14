import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { GET as health } from '@/app/api/health/route';
import { GET as products } from '@/app/api/products/route';
import { GET as workshops } from '@/app/api/workshops/route';
import { POST as orders } from '@/app/api/orders/route';
import { POST as bookings } from '@/app/api/bookings/route';
import { GET as summary } from '@/app/api/admin/summary/route';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrapi-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
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
    const ok = await orders(post('/api/orders', JSON.stringify({ items: [{ productId: 'p2', quantity: 1 }] })));
    expect(ok.status).toBe(201);
    const bad = await orders(post('/api/orders', JSON.stringify({ items: [] })));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Add at least one item.' });
  });
  it('invalid JSON → 400', async () => {
    const r = await orders(post('/api/orders', '{nope'));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'Invalid JSON' });
  });
  it('POST /api/bookings 201 / 404 / 409', async () => {
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'w3' })))).status).toBe(201);
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'x' })))).status).toBe(404);
    expect((await bookings(post('/api/bookings', JSON.stringify({ workshopId: 'w1', quantity: 50 })))).status).toBe(409);
  });
  it('summary counts', async () => {
    const j = await (await summary()).json();
    expect(j).toMatchObject({ products: 4, workshops: 3, orders: 0, bookings: 0 });
  });
});
