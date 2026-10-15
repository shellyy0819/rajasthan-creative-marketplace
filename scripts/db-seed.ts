import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '../src/db/client';
import * as schema from '../src/db/schema';
import { seedFromJson, truncateAll, type LegacyDb } from '../src/db/seed';

try { process.loadEnvFile('.env.local'); } catch { /* optional */ }

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:up`.'); process.exit(1); }

const reset = process.argv.includes('--reset');
const file = path.resolve('data/db.json');
const data: LegacyDb = JSON.parse(fs.readFileSync(file, 'utf8'));

async function main() {
  const client = postgres(url!, { max: 1, connect_timeout: 10 });
  const db = drizzle(client, { schema }) as unknown as Database;
  try {
    if (reset) { await truncateAll(db); console.log('Truncated all tables.'); }
    const inserted = await seedFromJson(db, data);
    console.log(`Seeded from ${path.relative(process.cwd(), file)}:`, inserted);
  } catch (e) {
    console.error('Seeding failed:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
void main();
