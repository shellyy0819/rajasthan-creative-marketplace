import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';
import { seedFromJson, type LegacyDb } from '../../src/db/seed';
import type { Database } from '../../src/db/client';

/** Deterministic catalog for e2e. Ids are high numerics (the slug parser needs p<digits>); id_counters are saved and restored around the run. */
export const FIX = {
  seller: 'E2E Clay Studio',
  products: { udaipur: 'E2E Lake Mug', jaipur: 'E2E Blue Dish' },
  workshop: 'E2E Pottery Basics',
};
const STATE = path.resolve('test-results/.e2e-counters.json');
const future = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

export const LEGACY: LegacyDb = {
  products: [
    { id: 'p9001', name: FIX.products.udaipur, category: 'Pottery', city: 'Udaipur', pricePaise: 45000, seller: FIX.seller, description: 'E2E hand-thrown mug.', stock: 5, status: 'APPROVED' },
    { id: 'p9002', name: FIX.products.jaipur, category: 'Accessories', city: 'Jaipur', pricePaise: 29900, seller: FIX.seller, description: 'E2E glazed dish.', stock: 3, status: 'APPROVED' },
    { id: 'p9003', name: 'E2E Hidden Draft', category: 'Pottery', city: 'Udaipur', pricePaise: 10000, seller: FIX.seller, description: 'Draft, must not be public.', stock: 1, status: 'DRAFT' },
  ],
  workshops: [
    { id: 'w9001', title: FIX.workshop, type: 'PAID', pricePaise: 120000, city: 'Udaipur', venue: 'E2E Studio', date: future, time: '10:00', seats: 10, booked: 0, host: FIX.seller, description: 'E2E wheel throwing.', status: 'APPROVED' },
  ],
  orders: [], bookings: [], counters: { p: 0, w: 0 },
} as unknown as LegacyDb;

const withDb = async <T>(fn: (db: Database, sql: postgres.Sql) => Promise<T>) => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 10 });
  try { return await fn(drizzle(sql, { schema }) as unknown as Database, sql); } finally { await sql.end(); }
};

export const FIX_IDS = { udaipur: 'p9001', jaipur: 'p9002', draft: 'p9003', workshop: 'w9001' };

export const seedE2E = () => withDb(async (db, sql) => {
  const rows = await sql`select prefix, value from id_counters`;
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(rows));
  return seedFromJson(db, LEGACY);
});

/** Put id_counters back to their pre-run values so e2e ids never shift the dev database's numbering. */
const restoreCounters = (sql: postgres.Sql) => {
  if (!fs.existsSync(STATE)) return Promise.resolve();
  const rows = JSON.parse(fs.readFileSync(STATE, 'utf8')) as { prefix: string; value: number }[];
  return (async () => {
    await sql`delete from id_counters where prefix in ('p','w')`;
    for (const r of rows) await sql`insert into id_counters (prefix, value) values (${r.prefix}, ${r.value}) on conflict (prefix) do update set value = excluded.value`;
    fs.rmSync(STATE);
  })();
};

export const cleanE2E = () => withDb(async (_db, sql) => {
  await sql`delete from product_likes where product_id ~ '^p900[0-9]$'`;
  await sql`delete from product_events where product_id ~ '^p900[0-9]$'`;
  await sql`delete from products where id ~ '^p900[0-9]$'`;
  await sql`delete from workshops where id ~ '^w900[0-9]$'`;
  await sql`delete from seller_profiles where display_name = ${FIX.seller}`;
  await sql`delete from users where email like 'e2e-clay-studio@%'`;
  await restoreCounters(sql);
});
