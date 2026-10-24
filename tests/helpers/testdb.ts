import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { setDb, type Database } from '../../src/db/client';
import { toBooking, toOrder, toProduct, toWorkshop, workshopsQuery } from '../../src/db/mappers';
import { bookings, orderItems, orders, users, userRoles } from '../../src/db/schema';
import { productsQuery } from '../../src/db/mappers';
import * as schema from '../../src/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '../../src/db/seed';

let db: Database | null = null;
const loadFixture = (): LegacyDb => JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/db.json'), 'utf8'));

/** One in-memory Postgres (PGlite) per test file, migrated once. */
export async function getTestDb(): Promise<Database> {
  if (!db) {
    const client = new PGlite({ extensions: { pg_trgm } });
    const d = drizzle(client, { schema });
    await migrate(d, { migrationsFolder: path.resolve('drizzle') });
    db = d as unknown as Database;
  }
  setDb(db);
  return db;
}

/** Fresh state for every test: truncate everything, reseed from tests/fixtures/db.json. */
export async function resetTestDb(fixture: LegacyDb = loadFixture()): Promise<Database> {
  const d = await getTestDb();
  await truncateAll(d);
  await seedFromJson(d, fixture);
  return d;
}

const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));

/** Whole-database view in domain shapes (replaces the old readDb() in assertions). */
export async function snapshot() {
  const d = await getTestDb();
  const [p, w, o, items, b] = await Promise.all([
    productsQuery(d), workshopsQuery(d),
    d.select({ o: orders, email: users.email }).from(orders).innerJoin(users, eq(users.id, orders.userId)).orderBy(asc(orders.createdAt), asc(orders.id)),
    d.select().from(orderItems).orderBy(asc(orderItems.id)),
    d.select({ b: bookings, email: users.email }).from(bookings).innerJoin(users, eq(users.id, bookings.userId)).orderBy(asc(bookings.createdAt), asc(bookings.id)),
  ]);
  return {
    products: byId(p.map(toProduct)),
    workshops: byId(w.map(toWorkshop)),
    orders: o.map(r => toOrder(r.o, r.email, items.filter(i => i.orderId === r.o.id))),
    bookings: b.map(r => toBooking(r.b, r.email)),
  };
}

/** Make `email` an admin/seller in the test database (creates the user). */
export async function giveRole(email: string, role: 'seller' | 'admin' | 'customer') {
  const { ensureUser, grantRole } = await import('../../src/db/people');
  const d = await getTestDb();
  const u = await ensureUser(d, email);
  if (role !== 'customer') await grantRole(d, u.id, role);
  return u;
}
export { userRoles };

/** A seller user with a public profile; returns the user id and the matching Actor. */
export async function makeSeller(email: string, displayName?: string) {
  const { ensureSellerProfile, grantRole } = await import('../../src/db/people');
  const { sellerProfiles } = await import('../../src/db/schema');
  const d = await getTestDb();
  const u = await giveRole(email, 'seller');
  await ensureSellerProfile(d, u.id, displayName ?? u.name);
  if (displayName) await d.update(sellerProfiles).set({ displayName }).where(eq(sellerProfiles.userId, u.id));
  void grantRole;
  return { id: u.id, actor: { email, role: 'seller' as const } };
}
