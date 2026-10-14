import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOrder, createBooking } from '@/lib/orders';
import { readDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rrord-'));
  const file = path.join(dir, 'db.json');
  fs.copyFileSync(path.resolve('tests/fixtures/db.json'), file);
  process.env.DB_PATH = file;
});

describe('createOrder', () => {
  it('creates order, totals, decrements stock', async () => {
    const o = await createOrder({ customerName: 'A', email: 'a@b.co', items: [{ productId: 'p1', quantity: 2 }] });
    expect(o.totalPaise).toBe(170000);
    expect(o.status).toBe('DEMO_ORDER_CREATED');
    expect((await readDb()).products.find(p => p.id === 'p1')!.stock).toBe(6);
  });
  it('rejects empty items with 400', async () => {
    await expect(createOrder({ items: [] })).rejects.toMatchObject({ status: 400, message: 'Add at least one item.' });
    await expect(createOrder(null)).rejects.toBeInstanceOf(ApiError);
  });
  it('rejects over-stock, bad qty, unknown product — and writes nothing', async () => {
    for (const items of [
      [{ productId: 'p1', quantity: 99 }],
      [{ productId: 'p1', quantity: 0 }],
      [{ productId: 'p1', quantity: 1.5 }],
      [{ productId: 'zzz', quantity: 1 }],
    ]) {
      await expect(createOrder({ items })).rejects.toMatchObject({ status: 400 });
    }
    const db = await readDb();
    expect(db.orders).toHaveLength(0);
    expect(db.products[0].stock).toBe(8);
  });
  it('rejects same product listed twice when combined qty exceeds stock', async () => {
    await expect(
      createOrder({ items: [{ productId: 'p3', quantity: 3 }, { productId: 'p3', quantity: 3 }] }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await readDb()).products.find(p => p.id === 'p3')!.stock).toBe(5);
  });
  it('does not oversell under concurrency', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => createOrder({ items: [{ productId: 'p3', quantity: 1 }] })),
    );
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(5);
    expect((await readDb()).products.find(p => p.id === 'p3')!.stock).toBe(0);
  });
});

describe('createBooking', () => {
  it('books free workshop as confirmed', async () => {
    const b = await createBooking({ workshopId: 'w3', attendeeName: 'X', email: 'x@y.co', quantity: 2 });
    expect(b.status).toBe('CONFIRMED_FREE_DEMO');
    expect(b.totalPaise).toBe(0);
    expect((await readDb()).workshops.find(w => w.id === 'w3')!.booked).toBe(8);
  });
  it('404 for unknown workshop, 409 for too many seats', async () => {
    await expect(createBooking({ workshopId: 'nope' })).rejects.toMatchObject({ status: 404 });
    await expect(createBooking({ workshopId: 'w1', quantity: 10 })).rejects.toMatchObject({ status: 409 });
  });
  it('does not overbook under concurrency', async () => {
    const r = await Promise.allSettled(
      Array.from({ length: 12 }, () => createBooking({ workshopId: 'w1', quantity: 1 })),
    );
    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(9);
  });
});

describe('malformed input is a 400, not a 500', () => {
  it('rejects null / non-object item entries', async () => {
    for (const items of [[null], ['p1'], [42]]) {
      await expect(createOrder({ items })).rejects.toMatchObject({ status: 400 });
    }
  });
});
