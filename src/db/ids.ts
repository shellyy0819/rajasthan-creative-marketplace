import { sql } from 'drizzle-orm';
import type { Q } from './client';
import { idCounters, products, workshops } from './schema';

/**
 * Atomically allocate the next id ('p5', 'w4', …). The counter row is locked by the upsert, so concurrent
 * callers get distinct ids, and it never goes backwards, so a deleted highest id is never reused.
 * It also self-heals if rows exist beyond the stored counter.
 */
export async function allocateId(q: Q, prefix: 'p' | 'w'): Promise<string> {
  const table = prefix === 'p' ? products : workshops;
  const maxExisting = sql`(select coalesce(max(substring(id from 2)::int), 0) from ${table} where id ~ ${`^${prefix}[0-9]+$`})`;
  const [row] = await q
    .insert(idCounters)
    .values({ prefix, value: sql`${maxExisting} + 1` })
    .onConflictDoUpdate({ target: idCounters.prefix, set: { value: sql`greatest(${idCounters.value}, ${maxExisting}) + 1` } })
    .returning({ value: idCounters.value });
  return `${prefix}${row.value}`;
}
