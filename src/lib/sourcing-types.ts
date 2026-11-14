import { asc, count, eq, sql } from 'drizzle-orm';
import { getDb, type Q } from '../db/client';
import { products, sourcingTypes } from '../db/schema';
import { checkCategoryName } from './category-name';
import { ApiError } from './errors';
import type { AdminSourcingType, SourcingType } from './types';
import { bad, obj, pick } from './validate';

export const MAX_SOURCING_TYPES = 20;
const LOCK = sql`select pg_advisory_xact_lock(hashtext('rr_sourcing_types'))`;
const NAME_HINT = 'name must be 2-40 characters: letters, numbers, spaces and & - \' , . ( ) /';

const cols = {
  id: sourcingTypes.id, name: sourcingTypes.name, countsAsHandmade: sourcingTypes.countsAsHandmade,
  showBadge: sourcingTypes.showBadge, position: sourcingTypes.position, active: sourcingTypes.active,
};
const order = [asc(sourcingTypes.position), asc(sourcingTypes.id)];

/** Public list: the types a seller may choose for a new product, in the admin's order. */
export async function listSourcingTypes(q: Q = getDb(), opts: { all?: boolean } = {}): Promise<SourcingType[]> {
  const base = q.select(cols).from(sourcingTypes);
  return opts.all ? base.orderBy(...order) : base.where(eq(sourcingTypes.active, true)).orderBy(...order);
}

/** Admin list: every type, with how many products use it. */
export async function listSourcingTypesForAdmin(q: Q = getDb()): Promise<AdminSourcingType[]> {
  return q.select({ ...cols, productCount: sql<number>`(select count(*) from products p where p.sourcing_type_id = "sourcing_types"."id")`.mapWith(Number) })
    .from(sourcingTypes).orderBy(...order);
}

/** The type a new product gets when none is chosen: the first active one in the admin's order. */
export async function defaultSourcingTypeId(q: Q): Promise<number> {
  const [row] = await q.select({ id: sourcingTypes.id }).from(sourcingTypes).where(eq(sourcingTypes.active, true)).orderBy(...order).limit(1);
  if (!row) throw new ApiError(409, 'No sourcing type is active. An admin must turn one on first.');
  return row.id;
}

/**
 * The id to store on a product. Nothing chosen: keep `currentId` (an edit) or take the default (a new product).
 * A chosen type must exist and be active, except that a product may keep the inactive type it already has.
 */
export async function resolveSourcingTypeId(q: Q, chosen: number | null | undefined, currentId?: number): Promise<number> {
  if (chosen === undefined || chosen === null || chosen === 0) return currentId ?? defaultSourcingTypeId(q);
  const [row] = await q.select({ id: sourcingTypes.id, active: sourcingTypes.active }).from(sourcingTypes).where(eq(sourcingTypes.id, chosen));
  if (!row) throw bad('sourcingTypeId must be an existing sourcing type.');
  if (!row.active && row.id !== currentId) throw bad('That sourcing type is switched off. Choose an active one.');
  return row.id;
}

function parseName(raw: unknown): string {
  const checked = checkCategoryName(raw);
  if (!checked.ok) throw bad(NAME_HINT);
  return checked.name;
}
function flag(v: unknown, field: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw bad(`${field} must be true or false.`);
  return v;
}
const duplicate = () => new ApiError(409, 'A sourcing type with that name already exists.');
const isUniqueViolation = (e: unknown) => [e, (e as { cause?: unknown } | null)?.cause].some(x => (x as { code?: string } | null)?.code === '23505');

export async function createSourcingType(input: unknown): Promise<AdminSourcingType> {
  const b = pick(obj(input), ['name', 'countsAsHandmade', 'showBadge']);
  const name = parseName(b.name);
  const countsAsHandmade = flag(b.countsAsHandmade, 'countsAsHandmade') ?? false;
  const showBadge = flag(b.showBadge, 'showBadge') ?? true;
  return getDb().transaction(async tx => {
    await tx.execute(LOCK);
    const [{ n, top }] = await tx.select({ n: count(), top: sql<number>`coalesce(max(${sourcingTypes.position}), 0)`.mapWith(Number) }).from(sourcingTypes);
    if (n >= MAX_SOURCING_TYPES) throw new ApiError(409, `Sourcing type limit reached (${MAX_SOURCING_TYPES}).`);
    let id: number;
    try { [{ id }] = await tx.insert(sourcingTypes).values({ name, countsAsHandmade, showBadge, position: top + 1 }).returning({ id: sourcingTypes.id }); }
    catch (e) { if (isUniqueViolation(e)) throw duplicate(); throw e; }
    return (await listSourcingTypesForAdmin(tx)).find(t => t.id === id)!;
  });
}

/** Rename, change the two switches, switch on or off, or move one place up or down. */
export async function updateSourcingType(id: number, input: unknown): Promise<AdminSourcingType> {
  const b = pick(obj(input), ['name', 'countsAsHandmade', 'showBadge', 'active', 'move']);
  const patch: Partial<typeof sourcingTypes.$inferInsert> = {};
  if (b.name !== undefined) patch.name = parseName(b.name);
  const ch = flag(b.countsAsHandmade, 'countsAsHandmade'); if (ch !== undefined) patch.countsAsHandmade = ch;
  const sb = flag(b.showBadge, 'showBadge'); if (sb !== undefined) patch.showBadge = sb;
  const ac = flag(b.active, 'active'); if (ac !== undefined) patch.active = ac;
  if (b.move !== undefined && b.move !== 'up' && b.move !== 'down') throw bad("move must be 'up' or 'down'.");
  if (!Object.keys(patch).length && b.move === undefined) throw bad('Nothing to change.');
  return getDb().transaction(async tx => {
    await tx.execute(LOCK);
    const [row] = await tx.select(cols).from(sourcingTypes).where(eq(sourcingTypes.id, id));
    if (!row) throw new ApiError(404, 'Sourcing type not found.');
    if (patch.active === false && row.active) {
      const [{ n }] = await tx.select({ n: count() }).from(sourcingTypes).where(eq(sourcingTypes.active, true));
      if (n <= 1) throw new ApiError(409, 'At least one sourcing type must stay active.');
    }
    if (Object.keys(patch).length) {
      try { await tx.update(sourcingTypes).set(patch).where(eq(sourcingTypes.id, id)); }
      catch (e) { if (isUniqueViolation(e)) throw duplicate(); throw e; }
    }
    if (b.move) {
      const all = await tx.select({ id: sourcingTypes.id, position: sourcingTypes.position }).from(sourcingTypes).orderBy(...order);
      const i = all.findIndex(t => t.id === id), j = b.move === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < all.length) {
        // Positions are handed out one after another and never repeat, so swapping two neighbours is enough.
        await tx.update(sourcingTypes).set({ position: all[j].position }).where(eq(sourcingTypes.id, all[i].id));
        await tx.update(sourcingTypes).set({ position: all[i].position }).where(eq(sourcingTypes.id, all[j].id));
      }
    }
    return (await listSourcingTypesForAdmin(tx)).find(t => t.id === id)!;
  });
}

/** Only a type no product uses can be deleted (switch it off otherwise), and never the last active one. */
export async function deleteSourcingType(id: number): Promise<void> {
  await getDb().transaction(async tx => {
    await tx.execute(LOCK);
    const [row] = await tx.select(cols).from(sourcingTypes).where(eq(sourcingTypes.id, id));
    if (!row) throw new ApiError(404, 'Sourcing type not found.');
    const [{ n }] = await tx.select({ n: count() }).from(products).where(eq(products.sourcingTypeId, id));
    if (n > 0) throw new ApiError(409, `${n} product${n === 1 ? ' uses' : 's use'} this type. Switch it off instead of deleting it.`);
    if (row.active) {
      const [{ a }] = await tx.select({ a: count() }).from(sourcingTypes).where(eq(sourcingTypes.active, true));
      if (a <= 1) throw new ApiError(409, 'At least one sourcing type must stay active.');
    }
    await tx.delete(sourcingTypes).where(eq(sourcingTypes.id, id));
  });
}
