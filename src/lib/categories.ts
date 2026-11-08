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

export const ONBOARDING_HEADROOM = 20;
/** Onboarding may create a new category only while fewer than this many exist; the rest is kept for staff. */
export const ONBOARDING_CATEGORY_LIMIT = MAX_CATEGORIES - ONBOARDING_HEADROOM;
export const ONBOARDING_LIMIT_MESSAGE = "We can't add new categories right now. Please choose the closest one or contact Craftofy.";

/**
 * Finds or creates a category inside the caller's transaction. An existing name (any case/spacing/Unicode form) is reused
 * as stored with NO rule check, so legacy names that break today's rule keep working; that lookup happens before the
 * lock, so reuse does not serialise. A new name must follow the name rule (400), then the global category lock is taken,
 * existence is re-checked under it, and the cap is applied (`limit`, 409 with `limitMessage`) before the insert.
 */
export async function ensureCategory(
  tx: Q, raw: unknown, createdBy: string,
  opts: { limit?: number; limitMessage?: string } = {},
): Promise<{ name: string; created: boolean }> {
  const limit = opts.limit ?? MAX_CATEGORIES;
  if (typeof raw !== 'string' || /\p{Cc}/u.test(raw)) throw bad(CATEGORY_HINT);
  const find = async (n: string) => (await tx.select({ name: categories.name }).from(categories).where(sql`lower(${categories.name}) = ${n.toLowerCase()}`))[0];
  const wanted = collapse(raw);
  const found = wanted ? await find(wanted) : undefined;
  if (found) return { name: found.name, created: false };
  const checked = checkCategoryName(raw);
  if (!checked.ok) throw bad(checked.error);
  const name = checked.name;
  // One lock for all category writes: the cap check and the insert must not race.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('rr_categories'))`);
  const again = await find(name);
  if (again) return { name: again.name, created: false };
  const [{ n }] = await tx.select({ n: count() }).from(categories);
  if (n >= limit) throw new ApiError(409, opts.limitMessage ?? `Category limit reached (${MAX_CATEGORIES}).`);
  const [row] = await tx.insert(categories).values({ name, createdBy }).returning({ name: categories.name });
  return { name: row.name, created: true };
}

/** Idempotent: an existing name (any case) is returned as stored with created=false. Sellers and admins may add categories. */
export async function createCategory(input: unknown, actorEmail: string): Promise<{ name: string; created: boolean }> {
  const name = obj(input).name;
  return getDb().transaction(async tx => {
    const me = await ensureUser(tx, actorEmail);
    return ensureCategory(tx, name, me.id);
  });
}
