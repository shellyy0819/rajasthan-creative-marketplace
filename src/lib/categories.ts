import { asc, count, sql } from 'drizzle-orm';
import { getDb, type Q } from '../db/client';
import { ensureUser } from '../db/people';
import { categories } from '../db/schema';
import { ApiError } from './errors';
import { bad, obj } from './validate';

export const MAX_CATEGORIES = 100;
import { CATEGORY_HINT, checkCategoryName, collapseSpaces as collapse } from './category-name';
export { CATEGORY_HINT };

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

/**
 * Finds or creates a category inside the caller's transaction (same advisory lock for all category writes, so the cap
 * check and the insert cannot race and two callers with one new name create one row). A rule-breaking name throws a 400,
 * the cap a 409. Returns the stored spelling.
 */
export async function ensureCategory(tx: Q, raw: unknown, createdBy: string): Promise<{ name: string; created: boolean }> {
  const checked = checkCategoryName(raw);
  if (!checked.ok) throw bad(checked.error);
  const name = checked.name;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rr_categories'))`);
  const [existing] = await tx.select({ name: categories.name }).from(categories).where(sql`lower(${categories.name}) = ${name.toLowerCase()}`);
  if (existing) return { name: existing.name, created: false };
  const [{ n }] = await tx.select({ n: count() }).from(categories);
  if (n >= MAX_CATEGORIES) throw new ApiError(409, `Category limit reached (${MAX_CATEGORIES}).`);
  const [row] = await tx.insert(categories).values({ name, createdBy }).returning({ name: categories.name });
  return { name: row.name, created: true };
}

/** Idempotent: an existing name (any case) is returned as stored with created=false. Sellers and admins may add categories. */
export async function createCategory(input: unknown, actorEmail: string): Promise<{ name: string; created: boolean }> {
  const checked = checkCategoryName(obj(input).name);
  if (!checked.ok) throw bad(checked.error);
  return getDb().transaction(async tx => {
    const me = await ensureUser(tx, actorEmail);
    return ensureCategory(tx, checked.name, me.id);
  });
}
