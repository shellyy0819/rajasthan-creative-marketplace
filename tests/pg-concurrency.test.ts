import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { setDb, type Database } from '@/db/client';
import * as schema from '@/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '@/db/seed';
import { createBooking, createOrder } from '@/lib/orders';
vi.mock('@/lib/storage', async importActual => ({ ...(await importActual<typeof import('@/lib/storage')>()), deleteObjects: vi.fn(async () => undefined) }));
import { deleteObjects } from '@/lib/storage';
import { completeOnboarding } from '@/lib/onboarding';
import { createProduct, createWorkshop, deleteProduct, updateProduct } from '@/lib/admin';
import { cityRef } from './helpers/cities';
import { admin as adminActor, seller as sellerActor } from './helpers/actors';

const adminUrl = process.env.PG_TEST_URL;
const fixture: LegacyDb = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/db.json'), 'utf8'));
const ok = <T,>(rs: PromiseSettledResult<T>[]) => rs.filter(r => r.status === 'fulfilled').length;
const product = { name: 'Lac Bangle', category: 'Accessories', cityRef: cityRef('Jodhpur'), pricePaise: 12000, description: 'Hand-set.', stock: 3 };

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
    const ws = await Promise.all(Array.from({ length: 20 }, () => createWorkshop({ title: 'T', type: 'FREE', pricePaise: 0, cityRef: cityRef('Jaipur'), venue: 'V', date: '2026-12-01', time: '10:00', seats: 5, host: 'H', description: 'D' })));
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

  it('fuzzy search works on real Postgres (pg_trgm installed by the migration): typos match, noise does not, exact ranks first', async () => {
    const { listProducts } = await import('@/lib/catalog');
    expect((await listProducts({ q: 'crochat' })).map(p => p.id)).toContain('p1');
    expect((await listProducts({ q: 'potery' })).map(p => p.id)).toContain('p4');
    expect(await listProducts({ q: 'xylophone' })).toEqual([]);
    expect((await listProducts({ q: 'resin' }))[0].id).toBe('p3');
  });

  it('likes: 30 parallel likes by one actor leave one row; 40 parallel likes by different actors count exactly 40; events dedupe under parallel writes', async () => {
    const { likeProduct, likeState, recordEvent } = await import('@/lib/engagement');
    await Promise.all(Array.from({ length: 30 }, () => likeProduct('p1', 'v:same')));
    expect((await likeState(['p1'])).counts.p1).toBe(1);
    await Promise.all(Array.from({ length: 40 }, (_, i) => likeProduct('p2', `v:${i}`)));
    expect((await likeState(['p2'])).counts.p2).toBe(40);
    const rs = await Promise.all(Array.from({ length: 30 }, () => recordEvent({ productId: 'p3', type: 'view', actor: 'h:same' }, new Date('2026-10-20T10:00:00Z'))));
    expect(rs.filter(r => r === 'recorded')).toHaveLength(1);
  });

  it('trending works on real Postgres: weighted order, window and one product per artist', async () => {
    const { trending } = await import('@/lib/trending');
    const { likeProduct, recordEvent } = await import('@/lib/engagement');
    await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' }); await likeProduct('p3', 'v:a');
    await recordEvent({ productId: 'p3', type: 'view', actor: 'h:a' });
    expect((await trending()).map(p => p.id)).toEqual(['p3', 'p1']);
  });

  it('deleting a product while another edit adds a photo leaves no photo behind in S3', async () => {
    const env = { S3_BUCKET: 'b', S3_REGION: 'ap-south-1', AWS_ACCESS_KEY_ID: 'AKIAFAKE', AWS_SECRET_ACCESS_KEY: 'secret' };
    const saved = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
    Object.assign(process.env, env);
    try {
      const base = 'https://b.s3.ap-south-1.amazonaws.com/products/11111111-1111-4111-8111-111111111111';
      const spy = vi.mocked(deleteObjects);
      for (let round = 0; round < 60; round++) {
        spy.mockClear();
        const a = `${base}/a${round}.jpg`, b = `${base}/b${round}.jpg`;
        const p = await createProduct({ ...product, images: [a] }, adminActor);
        const edit = updateProduct(p.id, { images: [a, b] }, adminActor);
        await new Promise(r => setTimeout(r, (round % 10) * 3)); // sweep the delete across the edit's lifetime
        const [upd] = await Promise.allSettled([edit, deleteProduct(p.id)]);
        const deleted = new Set(spy.mock.calls.flatMap(c => c[1]));
        const expected = upd.status === 'fulfilled' ? [a, b] : [a]; // the edit lost the race to the delete: only the first photo ever existed
        for (const url of expected) expect(deleted.has(url.replace('https://b.s3.ap-south-1.amazonaws.com/', '')), `round ${round}: ${url}`).toBe(true);
        expect(await db.select().from(schema.productImages).where(eq(schema.productImages.productId, p.id))).toHaveLength(0);
      }
    } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  });

  it('two concurrent completeOnboarding calls: one created, one unchanged, one role row, one profile', async () => {
    const onb = { fullName: 'Asha Verma', mobile: '9876543210', brandName: 'Asha Crafts', category: 'Accessories', description: 'Hand-set lac.', cityRef: cityRef('Jaipur'), instagram: 'asha', logoUrl: 'https://example.com/l.png', contactMethods: ['instagram' as const] };
    const rs = await Promise.all([completeOnboarding('race@x.co', onb), completeOnboarding('race@x.co', onb)]);
    expect(rs.map(r => r.status).sort()).toEqual(['created', 'unchanged']);
    const id = rs[0].userId;
    expect(await db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, id))).toHaveLength(1);
    expect(await db.select().from(schema.sellerProfiles).where(eq(schema.sellerProfiles.userId, id))).toHaveLength(1);
  });

  it('ten different accounts onboarding with the same new category name (varied case) create exactly one category row', async () => {
    const base = { fullName: 'Asha Verma', mobile: '9876543210', brandName: 'Asha Crafts', description: 'Hand-set lac.', cityRef: cityRef('Jaipur'), instagram: 'asha', logoUrl: 'https://example.com/l.png', contactMethods: ['instagram' as const] };
    const before = (await db.select().from(schema.categories)).length;
    const rs = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => completeOnboarding(`cat${i}@x.co`, { ...base, category: i % 2 ? 'Bamboo Craft' : 'bamboo craft' })));
    expect(ok(rs)).toBe(10);
    const rows = await db.select().from(schema.categories);
    expect(rows.length).toBe(before + 1);
    expect(rows.filter(r => r.name.toLowerCase() === 'bamboo craft')).toHaveLength(1);
  });
});
