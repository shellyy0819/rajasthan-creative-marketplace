import { asc, count, sql } from 'drizzle-orm';
import { getDb, type Q } from '../db/client';
import { ensureUser } from '../db/people';
import { categories } from '../db/schema';
import { ApiError } from './errors';
import { bad, obj } from './validate';

export const MAX_CATEGORIES = 100;
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} &\-',.()/]*$/u;
export const CATEGORY_HINT = 'name must be 2-40 characters: letters, numbers, spaces and & - \' , . ( ) /';

const collapse = (s: string) => s.trim().replace(/\s+/g, ' ');

export async function listCategories(q: Q = getDb()): Promise<string[]> {
  return (await q.select({ name: categories.name }).from(categories).orderBy(asc(categories.id))).map(r => r.name);
}

/** The stored spelling of a category (matched ignoring case/spacing), or a 400 telling the user to create it first. */
export async function canonicalCategory(q: Q, value: unknown): Promise<string> {
  const msg = 'category must be an existing category. Create it first.';
  if (typeof value !== 'string' || !collapse(value)) throw bad(msg);
  const [row] = await q.select({ name: categories.name }).from(categories).where(sql`lower(${categories.name}) = ${collapse(value).toLowerCase()}`);
  if (!row) throw bad(msg);
  return row.name;
}

/** Idempotent: an existing name (any case) is returned as stored with created=false. Sellers and admins may add categories. */
export async function createCategory(input: unknown, actorEmail: string): Promise<{ name: string; created: boolean }> {
  const raw = obj(input).name;
  if (typeof raw === 'string' && /\p{Cc}/u.test(raw)) throw bad(CATEGORY_HINT); // tabs/newlines/control characters
  const name = typeof raw === 'string' ? collapse(raw) : '';
  if (name.length < 2 || name.length > 40 || !NAME_RE.test(name) || !/\p{L}/u.test(name)) throw bad(CATEGORY_HINT);
  return getDb().transaction(async tx => {
    // One lock for all category writes: the cap check and the insert must not race.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rr_categories'))`);
    const [existing] = await tx.select({ name: categories.name }).from(categories).where(sql`lower(${categories.name}) = ${name.toLowerCase()}`);
    if (existing) return { name: existing.name, created: false };
    const [{ n }] = await tx.select({ n: count() }).from(categories);
    if (n >= MAX_CATEGORIES) throw new ApiError(409, `Category limit reached (${MAX_CATEGORIES}).`);
    const me = await ensureUser(tx, actorEmail);
    const [row] = await tx.insert(categories).values({ name, createdBy: me.id }).returning({ name: categories.name });
    return { name: row.name, created: true };
  });
}
