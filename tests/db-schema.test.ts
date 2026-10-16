import fs from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getTestDb, giveRole, resetTestDb, snapshot } from './helpers/testdb';
import { seedFromJson, truncateAll, type LegacyDb } from '@/db/seed';
import { allocateId } from '@/db/ids';
import { idCounters, orderItems, orders, products, workshops, users } from '@/db/schema';
import { productsQuery, toProduct, toProductRow } from '@/db/mappers';

const valid = { name: 'N', category: 'Pottery', city: 'Jaipur', pricePaise: 100, description: 'D', stock: 1, status: 'APPROVED' };
let sellerId: string;
let buyerId: string;
const fixture = (): LegacyDb => JSON.parse(fs.readFileSync('tests/fixtures/db.json', 'utf8'));

beforeEach(async () => {
  await resetTestDb();
  sellerId = (await giveRole('s@x.co', 'seller')).id;
  buyerId = (await giveRole('b@x.co', 'customer')).id;
});

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
      await expect(db.insert(products).values({ id: 'x1', sellerId, ...valid, ...bad })).rejects.toThrow();
    expect((await snapshot()).products).toHaveLength(4);
  });
  it('rejects overbooked or malformed workshops', async () => {
    const db = await getTestDb();
    const w = { id: 'wx', title: 'T', type: 'PAID', pricePaise: 1, city: 'Jaipur', venue: 'V', startsAt: new Date('2026-12-01T10:00:00+05:30'), seats: 5, booked: 0, hostName: 'H', description: 'D', status: 'APPROVED' };
    for (const bad of [{ booked: 6 }, { booked: -1 }, { seats: 0 }, { type: 'MAYBE' }])
      await expect(db.insert(workshops).values({ ...w, ...bad })).rejects.toThrow();
  });
  it('rejects order items with quantity 0', async () => {
    const db = await getTestDb();
    await db.insert(orders).values({ id: 'o1', userId: buyerId, customerName: 'A', email: 'a@b.co', totalPaise: 1, status: 'S', note: 'N' });
    await expect(db.insert(orderItems).values({ orderId: 'o1', productId: 'p1', name: 'n', seller: 's', quantity: 0, unitPricePaise: 1, lineTotalPaise: 0 })).rejects.toThrow();
  });
  it('order history survives deleting the product (no foreign key on product_id)', async () => {
    const db = await getTestDb();
    await db.insert(orders).values({ id: 'o1', userId: buyerId, customerName: 'A', email: 'a@b.co', totalPaise: 1, status: 'S', note: 'N' });
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
  it('imports legacy orders with items and bookings; a missing userEmail maps to the legacy placeholder user', async () => {
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
    expect(s.orders[0]).toMatchObject({ id: 'o-1', userEmail: 'legacy@rangrajasthan.invalid', createdAt: '2026-10-01T10:00:00.000Z' });
    expect(s.orders[0].items.map(i => i.productId)).toEqual(['p1', 'p2']);
    expect(s.bookings[0]).toMatchObject({ id: 'b-1', userEmail: 'legacy@rangrajasthan.invalid' });
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
    const [row] = await productsQuery(db).where(eq(products.id, 'p2'));
    expect(row.instagram).toBeNull();
    const p = toProduct(row);
    expect('instagram' in p).toBe(false);
    expect(JSON.stringify(p)).not.toContain('null');
    expect(toProductRow(p).imageUrl).toBeNull();
    expect(toProductRow(p).workshopId).toBeNull();
  });
});

describe('users, roles and profiles (new tables)', () => {
  it('seeds the roles table (seller=1, admin=2) and keeps it across truncateAll', async () => {
    const db = await getTestDb();
    const { roles } = await import('@/db/schema');
    await truncateAll(db);
    expect((await db.select().from(roles)).map(r => [r.id, r.name]).sort()).toEqual([[1, 'seller'], [2, 'admin']]);
  });
  it('seeding creates one seller user + profile per distinct seller name with contact copied from products', async () => {
    const legacy = fixture();
    legacy.products[0] = { ...legacy.products[0], instagram: 'shaukandstuff', phone: '9997979999' };
    legacy.products.push({ ...legacy.products[0], id: 'p9', name: 'Another' }); // same seller name, same user
    const db = await resetTestDb(legacy);
    const { sellerProfiles, userRoles } = await import('@/db/schema');
    const profiles = await db.select().from(sellerProfiles);
    expect(profiles.map(p => p.displayName).sort()).toEqual(['Lake City Knots', 'Neel Mitti Studio', 'Petal & Pour', 'Shauk and Stuff']);
    expect(profiles.find(p => p.displayName === 'Shauk and Stuff')).toMatchObject({ instagram: 'shaukandstuff', publicPhone: '9997979999' });
    expect((await db.select().from(userRoles)).length).toBeGreaterThanOrEqual(4);
    const s = await snapshot();
    expect(s.products.find(p => p.id === 'p1')).toMatchObject({ seller: 'Shauk and Stuff', instagram: 'shaukandstuff', phone: '9997979999' });
    expect(s.products.find(p => p.id === 'p9')!.seller).toBe('Shauk and Stuff');
  });
  it('email is unique case-insensitively; google_sub is optional but unique', async () => {
    const db = await getTestDb();
    await db.insert(users).values({ email: 'Case@X.co', name: 'A' });
    await expect(db.insert(users).values({ email: 'case@x.CO', name: 'B' })).rejects.toThrow();
    await db.insert(users).values({ email: 'g1@x.co', name: 'G', googleSub: 'sub-1' });
    await expect(db.insert(users).values({ email: 'g2@x.co', name: 'G2', googleSub: 'sub-1' })).rejects.toThrow();
  });
  it('a user who owns products cannot be deleted (restrict), but deleting a workshop only unlinks its products', async () => {
    const db = await getTestDb();
    await expect(db.delete(users).where(eq(users.id, sellerId))).resolves.toBeDefined(); // owns nothing yet
    const owner = (await giveRole('o@x.co', 'seller')).id;
    await db.insert(products).values({ id: 'px', sellerId: owner, ...valid, workshopId: 'w1' });
    await expect(db.delete(users).where(eq(users.id, owner))).rejects.toThrow();
    await db.delete(workshops).where(eq(workshops.id, 'w1'));
    const [row] = await db.select().from(products).where(eq(products.id, 'px'));
    expect(row.workshopId).toBeNull();
  });
  it('workshops expose date/time in India time and starts_at round-trips', async () => {
    const w = (await snapshot()).workshops.find(x => x.id === 'w1')!;
    expect(w).toMatchObject({ date: '2026-11-08', time: '11:00', host: 'Shauk and Stuff' });
    const db = await getTestDb();
    const [row] = await db.select().from(workshops).where(eq(workshops.id, 'w1'));
    expect(row.startsAt.toISOString()).toBe('2026-11-08T05:30:00.000Z');
  });
});
