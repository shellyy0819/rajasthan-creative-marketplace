import fs from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb, resetTestDb, snapshot } from './helpers/testdb';
import { seedFromJson, truncateAll, type LegacyDb } from '@/db/seed';
import { allocateId } from '@/db/ids';
import { idCounters, orderItems, orders, products, workshops } from '@/db/schema';
import { toProduct, toProductRow } from '@/db/mappers';

const valid = { name: 'N', category: 'Pottery', city: 'Jaipur', pricePaise: 100, seller: 'S', description: 'D', stock: 1, status: 'APPROVED' };
const fixture = (): LegacyDb => JSON.parse(fs.readFileSync('tests/fixtures/db.json', 'utf8'));

beforeEach(async () => { await resetTestDb(); });

describe('migrations + fixture seed', () => {
  it('creates the schema and seeds the fixture', async () => {
    const s = await snapshot();
    expect(s.products.map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(s.workshops.map(w => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(s.orders).toEqual([]);
  });
});

describe('constraints protect the data even if app code is wrong', () => {
  it('rejects negative stock/price, unknown status', async () => {
    const db = await getTestDb();
    for (const bad of [{ stock: -1 }, { pricePaise: -5 }, { status: 'HACK' }])
      await expect(db.insert(products).values({ id: 'x1', ...valid, ...bad })).rejects.toThrow();
    expect((await snapshot()).products).toHaveLength(4);
  });
  it('rejects overbooked or malformed workshops', async () => {
    const db = await getTestDb();
    const w = { id: 'wx', title: 'T', type: 'PAID', pricePaise: 1, city: 'Jaipur', venue: 'V', date: '2026-12-01', time: '10:00', seats: 5, booked: 0, host: 'H', description: 'D', status: 'APPROVED' };
    for (const bad of [{ booked: 6 }, { booked: -1 }, { seats: 0 }, { type: 'MAYBE' }])
      await expect(db.insert(workshops).values({ ...w, ...bad })).rejects.toThrow();
  });
  it('rejects order items with quantity 0', async () => {
    const db = await getTestDb();
    await db.insert(orders).values({ id: 'o1', userEmail: 'a@b.co', customerName: 'A', email: 'a@b.co', totalPaise: 1, status: 'S', note: 'N' });
    await expect(db.insert(orderItems).values({ orderId: 'o1', productId: 'p1', name: 'n', seller: 's', quantity: 0, unitPricePaise: 1, lineTotalPaise: 0 })).rejects.toThrow();
  });
  it('order history survives deleting the product (no foreign key on product_id)', async () => {
    const db = await getTestDb();
    await db.insert(orders).values({ id: 'o1', userEmail: 'a@b.co', customerName: 'A', email: 'a@b.co', totalPaise: 1, status: 'S', note: 'N' });
    await db.insert(orderItems).values({ orderId: 'o1', productId: 'p1', name: 'Crochet Lily Bouquet', seller: 's', quantity: 1, unitPricePaise: 1, lineTotalPaise: 1 });
    await db.delete(products).where(eq(products.id, 'p1'));
    expect((await snapshot()).orders[0].items[0].name).toBe('Crochet Lily Bouquet');
  });
});

describe('seedFromJson is idempotent and keeps counters', () => {
  it('second run inserts nothing and changes nothing', async () => {
    const db = await getTestDb();
    const again = await seedFromJson(db, fixture());
    expect(again).toEqual({ products: 0, workshops: 0, orders: 0, bookings: 0 });
    expect((await snapshot()).products).toHaveLength(4);
  });
  it('sets counters from existing ids so the next id continues the sequence', async () => {
    const db = await getTestDb();
    expect(await allocateId(db, 'p')).toBe('p5');
    expect(await allocateId(db, 'p')).toBe('p6');
    expect(await allocateId(db, 'w')).toBe('w4');
  });
  it('honours a larger legacy counter (a deleted highest id is never reused)', async () => {
    const db = await resetTestDb({ ...fixture(), counters: { p: 9 } });
    expect(await allocateId(db, 'p')).toBe('p10');
  });
  it('re-seeding never lowers a counter', async () => {
    const db = await resetTestDb({ ...fixture(), counters: { p: 9 } });
    await seedFromJson(db, fixture());
    expect(await allocateId(db, 'p')).toBe('p10');
  });
  it('imports legacy orders with items and bookings; missing userEmail becomes empty', async () => {
    const legacy: LegacyDb = {
      ...fixture(),
      orders: [{ id: 'o-1', createdAt: '2026-10-01T10:00:00.000Z', customerName: 'C', email: 'c@x.co', items: [
        { productId: 'p1', name: 'A', seller: 'S', quantity: 2, unitPricePaise: 5, lineTotalPaise: 10 },
        { productId: 'p2', name: 'B', seller: 'S', quantity: 1, unitPricePaise: 7, lineTotalPaise: 7 }], totalPaise: 17, status: 'DEMO_ORDER_CREATED', note: 'n' } as any],
      bookings: [{ id: 'b-1', createdAt: '2026-10-02T10:00:00.000Z', workshopId: 'w1', title: 'T', attendeeName: 'A', email: 'a@x.co', quantity: 1, totalPaise: 0, status: 'S', note: 'n' } as any],
    };
    const db = await resetTestDb(legacy);
    const s = await snapshot();
    expect(s.orders).toHaveLength(1);
    expect(s.orders[0]).toMatchObject({ id: 'o-1', userEmail: '', createdAt: '2026-10-01T10:00:00.000Z' });
    expect(s.orders[0].items.map(i => i.productId)).toEqual(['p1', 'p2']);
    expect(s.bookings[0]).toMatchObject({ id: 'b-1', userEmail: '' });
    await truncateAll(db);
    expect((await snapshot()).products).toEqual([]);
  });
});

describe('allocateId', () => {
  it('is safe when the counter row is missing but rows exist, and under parallel callers', async () => {
    const db = await getTestDb();
    await db.delete(idCounters);
    const ids = await Promise.all(Array.from({ length: 20 }, () => db.transaction(tx => allocateId(tx, 'p'))));
    expect(new Set(ids).size).toBe(20);
    expect(ids.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))[0]).toBe('p5');
  });
});

describe('mappers', () => {
  it('omit unset optional fields (no nulls leak into JSON) and round-trip', async () => {
    const db = await getTestDb();
    const [row] = await db.select().from(products).where(eq(products.id, 'p2'));
    expect(row.instagram).toBeNull();
    const p = toProduct(row);
    expect('instagram' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('null');
    expect(toProductRow(p).instagram).toBeNull();
  });
});
