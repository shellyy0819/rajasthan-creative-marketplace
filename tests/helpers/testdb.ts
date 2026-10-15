import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { setDb, type Database } from '../../src/db/client';
import { toBooking, toOrder, toProduct, toWorkshop } from '../../src/db/mappers';
import { bookings, orderItems, orders, products, workshops } from '../../src/db/schema';
import * as schema from '../../src/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '../../src/db/seed';

let db: Database | null = null;
const loadFixture = (): LegacyDb => JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/db.json'), 'utf8'));

/** One in-memory Postgres (PGlite) per test file, migrated once. */
export async function getTestDb(): Promise<Database> {
  if (!db) {
    const client = new PGlite();
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
    d.select().from(products), d.select().from(workshops),
    d.select().from(orders).orderBy(asc(orders.createdAt), asc(orders.id)),
    d.select().from(orderItems).orderBy(asc(orderItems.id)),
    d.select().from(bookings).orderBy(asc(bookings.createdAt), asc(bookings.id)),
  ]);
  return {
    products: byId(p.map(toProduct)),
    workshops: byId(w.map(toWorkshop)),
    orders: o.map(r => toOrder(r, items.filter(i => i.orderId === r.id))),
    bookings: b.map(toBooking),
  };
}
