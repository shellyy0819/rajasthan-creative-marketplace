import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Q = Database | Tx;

let override: Database | null = null;
const g = globalThis as unknown as { __rrDb?: Database };

/** Tests install an in-process PGlite database here; pass null to go back to DATABASE_URL. */
export function setDb(db: Database | null): void { override = db; }

export function getDb(): Database {
  if (override) return override;
  if (g.__rrDb) return g.__rrDb; // survives Next.js dev hot reloads
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:up`.');
  const client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  g.__rrDb = drizzle(client, { schema }) as unknown as Database;
  return g.__rrDb;
}
