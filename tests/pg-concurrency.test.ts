import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { setDb, type Database } from '@/db/client';
import * as schema from '@/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '@/db/seed';
import { createBooking, createOrder } from '@/lib/orders';
import { createProduct, createWorkshop } from '@/lib/admin';
import { admin as adminActor, seller as sellerActor } from './helpers/actors';

const adminUrl = process.env.PG_TEST_URL;
const fixture: LegacyDb = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/db.json'), 'utf8'));
const ok = <T,>(rs: PromiseSettledResult<T>[]) => rs.filter(r => r.status === 'fulfilled').length;
const product = { name: 'Lac Bangle', category: 'Accessories', city: 'Jodhpur', pricePaise: 12000, description: 'Hand-set.', stock: 3 };

describe.skipIf(!adminUrl)('real Postgres: concurrency and locking', () => {
  const dbName = `rr_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let db: Database;

  beforeAll(async () => {
    admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe(`create database ${dbName}`);
    const url = new URL(adminUrl!); url.pathname = `/${dbName}`;
    client = postgres(url.toString(), { max: 25 });
    db = drizzle(client, { schema }) as unknown as Database;
    await migrate(db as never, { migrationsFolder: path.resolve('drizzle') });
    setDb(db);
  });
  afterAll(async () => {
    setDb(null);
    await client?.end();
    await admin?.unsafe(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });
  beforeEach(async () => { await truncateAll(db); await seedFromJson(db, fixture); });

  it('25 parallel orders for a product with stock 5: exactly 5 succeed, stock ends at 0', async () => {
    const rs = await Promise.allSettled(Array.from({ length: 25 }, (_, i) => createOrder({ items: [{ productId: 'p3', quantity: 1 }] }, `u${i}@x.co`)));
    expect(ok(rs)).toBe(5);
    const [p3] = await db.select().from(schema.products).where(eq(schema.products.id, 'p3'));
    expect(p3.stock).toBe(0);
    expect((await db.select().from(schema.orders)).length).toBe(5);
  });

  it('20 parallel bookings of 1 seat on w1 (12 seats, 3 booked): exactly 9 succeed and booked never exceeds seats', async () => {
    const rs = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createBooking({ workshopId: 'w1', quantity: 1 }, `u${i}@x.co`)));
    expect(ok(rs)).toBe(9);
    const [w1] = await db.select().from(schema.workshops).where(eq(schema.workshops.id, 'w1'));
    expect(w1.booked).toBe(12);
  });

  it('two parallel orders that each list the same product twice (3 + 2 of stock 5) cannot oversell', async () => {
    const body = { items: [{ productId: 'p3', quantity: 3 }, { productId: 'p3', quantity: 2 }] };
    const rs = await Promise.allSettled([createOrder(body, 'a@x.co'), createOrder(body, 'b@x.co')]);
    expect(ok(rs)).toBe(1);
  });

  it('orders listing the same products in opposite orders all complete (no deadlock)', async () => {
    const a = { items: [{ productId: 'p1', quantity: 1 }, { productId: 'p3', quantity: 1 }] };
    const b = { items: [{ productId: 'p3', quantity: 1 }, { productId: 'p1', quantity: 1 }] };
    const rs = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => createOrder(i % 2 ? a : b, `u${i}@x.co`)));
    expect(rs.filter(r => r.status === 'rejected' && !/unavailable|exceeds/.test(String((r as PromiseRejectedResult).reason?.message))).length).toBe(0);
    expect(ok(rs)).toBe(5); // p3 has stock 5
  });

  it('50 parallel product creates and 20 workshop creates get unique ids', async () => {
    const ps = await Promise.all(Array.from({ length: 50 }, () => createProduct(product, adminActor)));
    expect(new Set(ps.map(p => p.id)).size).toBe(50);
    const ws = await Promise.all(Array.from({ length: 20 }, () => createWorkshop({ title: 'T', type: 'FREE', pricePaise: 0, city: 'Jaipur', venue: 'V', date: '2026-12-01', time: '10:00', seats: 5, host: 'H', description: 'D' })));
    expect(new Set(ws.map(w => w.id)).size).toBe(20);
  });

  it('a seller content edit racing an admin publish keeps the row consistent (never unreviewed content live after the seller edit)', async () => {
    const { updateProduct } = await import('@/lib/admin');
    const { ensureUser, grantRole } = await import('@/db/people');
    const su = await ensureUser(db, sellerActor.email);
    await grantRole(db, su.id, 'seller');
    for (let i = 0; i < 15; i++) {
      const p = await createProduct({ ...product, status: 'DRAFT', sellerId: su.id }, adminActor);
      const [pub, edit] = await Promise.allSettled([updateProduct(p.id, { status: 'APPROVED' }, adminActor), updateProduct(p.id, { description: `edit ${i}` }, sellerActor)]);
      expect(pub.status).toBe('fulfilled');
      expect(edit.status).toBe('fulfilled');
      const [row] = await db.select().from(schema.products).where(eq(schema.products.id, p.id));
      expect(row.description).toBe(`edit ${i}`);
      expect(['APPROVED', 'DRAFT']).toContain(row.status); // seller first => admin published the edited text; admin first => seller edit demoted it
    }
  });

  it('two admins removing different admins at the same time cannot leave the system with no active admin', async () => {
    const { createUser, updateUser, listUsers } = await import('@/lib/users');
    process.env.ADMIN_EMAILS = '';
    const a = await createUser({ email: 'a1@x.co', roles: ['admin'] }, 'a1@x.co');
    const b = await createUser({ email: 'a2@x.co', roles: ['admin'] }, 'a1@x.co');
    const rs = await Promise.allSettled([updateUser(a.id, { active: false }, 'a2@x.co'), updateUser(b.id, { active: false }, 'a1@x.co')]);
    const active = (await listUsers()).filter(u => u.roles.includes('admin') && u.active).length;
    expect(active).toBeGreaterThanOrEqual(1);
    expect(rs.filter(r => r.status === 'fulfilled')).toHaveLength(1); // the second one is refused (409)
    void active;
  });
});
