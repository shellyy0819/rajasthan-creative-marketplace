import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, sellerNameSql, toAdminWorkshop, toProduct, toWorkshop, withPrices, workshopsQuery } from '../db/mappers';
import { cities, products as productsT, sellerProfiles, sourcingTypes, users, workshops as workshopsT } from '../db/schema';
import { getCityByNameOrSlug, sameCityIds } from './cities';
import { normalizeQuery, textSearch } from './search';
import { productSlug, workshopSlug } from './catalog-shared';
import type { Product, Workshop } from './types';
import { isCurrent, lastDay } from './workshop-listing';

export { DEFAULT_CATEGORIES, productSlug, workshopSlug } from './catalog-shared';

/** `limit`/`offset` return one page of the same ordering the full list has. */
export type ProductFilter = { city?: string; category?: string; source?: string; q?: string; limit?: number; offset?: number };
/**
 * `includeEnded`: the /workshops page also lists listings that have ended, after the ones still on.
 * `status`: only the ones still `open`, or only the `ended` ones (this wins over `includeEnded`).
 */
export type WorkshopFilter = { city?: string; type?: string; q?: string; mode?: string; includeEnded?: boolean; status?: 'open' | 'ended' };

const anyCity = (c?: string) => !c || c === 'All India';
const idOrder = (t: { id: typeof productsT.id | typeof workshopsT.id }) => [sql`length(${t.id})`, asc(t.id)] as const;
const productDoc = sql`concat_ws(' ', ${productsT.name}, ${productsT.description}, ${sellerNameSql}, ${productsT.category})`;
const workshopDoc = sql`concat_ws(' ', ${workshopsT.title}, ${workshopsT.description}, ${workshopsT.venue}, ${workshopsT.hostName})`;

/**
 * Which sourcing type (if any) a product search is tied to.
 *  - An explicit `source` (the Type filter) is strict: only products of that type, and the text, if any, must match as well.
 *  - A search that is exactly the name of a type (for example "handmade") finds both kinds of product: those whose sourcing is
 *    that type, and those whose name, description, maker or category says the word (`orText`).
 */
async function sourcingScope(f: ProductFilter): Promise<{ source?: string; q: string; orText?: boolean }> {
  const q = normalizeQuery(f.q);
  if (f.source) return { source: f.source, q };
  if (!q) return { q };
  const [hit] = await getDb().select({ name: sourcingTypes.name }).from(sourcingTypes)
    .where(sql`${sourcingTypes.active} and lower(${sourcingTypes.name}) = ${q.toLowerCase()}`);
  return hit ? { source: hit.name, q, orText: true } : { q };
}

/** The conditions every product listing and its count share. Null when the filter names a city that does not exist (nothing can match). */
async function productScope(f: ProductFilter) {
  const where: (SQL | undefined)[] = [eq(productsT.status, 'APPROVED')];
  if (!anyCity(f.city)) {
    const city = await getCityByNameOrSlug(f.city!);
    if (!city) return null;
    where.push(inArray(productsT.cityId, await sameCityIds(city)));
  }
  if (f.category && f.category !== 'All categories') where.push(eq(productsT.category, f.category));
  const scope = await sourcingScope(f);
  const search = textSearch(productDoc, scope.q);
  // A product with no sourcing type (null) never matches the type itself.
  const ofType = scope.source ? sql`${productsT.sourcingTypeId} in (select id from sourcing_types where lower(name) = ${scope.source.toLowerCase()})` : undefined;
  if (ofType && scope.orText && search.where) where.push(or(ofType, search.where));
  else { if (ofType) where.push(ofType); where.push(search.where); }
  return { where, search };
}

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const scope = await productScope(f);
  if (!scope) return [];
  const { where, search } = scope;
  const ordered = productsQuery(getDb()).where(and(...where)).orderBy(...(search.rank ? [desc(search.rank)] : []), ...idOrder(productsT));
  const rows = f.limit === undefined ? await ordered : await ordered.limit(f.limit).offset(f.offset ?? 0);
  return rows.map(toProduct);
}

/** How many published products match the filter (ignoring `limit` and `offset`): the total a paged list works toward. */
export async function countProducts(f: ProductFilter = {}): Promise<number> {
  const scope = await productScope(f);
  if (!scope) return 0;
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(productsT)
    .innerJoin(cities, eq(cities.id, productsT.cityId))
    .leftJoin(sourcingTypes, eq(sourcingTypes.id, productsT.sourcingTypeId))
    .innerJoin(users, eq(users.id, productsT.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(and(...scope.where));
  return row.n;
}

/** Published products per category, A to Z: the home shelf's filter tabs, without loading every product. */
export async function countProductsByCategory(): Promise<{ name: string; count: number }[]> {
  const rows = await getDb().select({ name: productsT.category, count: sql<number>`count(*)::int` }).from(productsT)
    .where(eq(productsT.status, 'APPROVED')).groupBy(productsT.category).orderBy(asc(productsT.category));
  return rows;
}

/**
 * Published listings that have not ended (India time); with `includeEnded`, the ended ones follow, the most recently ended first (their pages stay up
 * with a notice). Online classes have no city, so a city filter never matches them.
 */
export async function listWorkshops(f: WorkshopFilter = {}): Promise<Workshop[]> {
  const where: (SQL | undefined)[] = [eq(workshopsT.status, 'APPROVED')];
  if (!anyCity(f.city)) {
    const city = await getCityByNameOrSlug(f.city!);
    if (!city) return [];
    where.push(inArray(workshopsT.cityId, await sameCityIds(city)));
  }
  if (f.type && f.type !== 'ALL') where.push(eq(workshopsT.type, f.type));
  if (f.mode === 'online') where.push(inArray(workshopsT.mode, ['online', 'hybrid']));
  if (f.mode === 'in_person') where.push(inArray(workshopsT.mode, ['in_person', 'hybrid']));
  const search = textSearch(workshopDoc, f.q);
  where.push(search.where);
  const rows = await workshopsQuery(getDb()).where(and(...where)).orderBy(...(search.rank ? [desc(search.rank)] : []), ...idOrder(workshopsT));
  const all = await withPrices(getDb(), rows.map(toWorkshop));
  const current = all.filter(w => isCurrent(w));
  if (f.status === 'open' || (!f.status && !f.includeEnded)) return current;
  const ended = all.filter(w => !isCurrent(w)).sort((a, b) => (lastDay(b) ?? '').localeCompare(lastDay(a) ?? ''));
  return f.status === 'ended' ? ended : [...current, ...ended];
}

/** Every listing in every status, newest first, with the admin-only fields. For the dashboard. */
export async function listAdminWorkshops(): Promise<Workshop[]> {
  const rows = await workshopsQuery(getDb()).orderBy(desc(sql`length(${workshopsT.id})`), desc(workshopsT.id));
  return withPrices(getDb(), rows.map(toAdminWorkshop));
}

/**
 * A listing as visitors would see it, whatever its status (Draft and Archived included), found by id. For the dashboard's preview only:
 * the public mapper is used on purpose, so the preview never shows the host's private contact details or anything else the real page would not.
 */
export async function getWorkshopPreview(id: string): Promise<Workshop | undefined> {
  if (!/^w\d+$/.test(id)) return undefined;
  const [row] = await workshopsQuery(getDb()).where(eq(workshopsT.id, id));
  return row ? (await withPrices(getDb(), [toWorkshop(row)]))[0] : undefined;
}

/** slug = "<name>-<id>": look the id up directly, then require the exact slug (wrong name part → undefined). */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^p\d+$/.test(id)) return undefined;
  const [row] = await productsQuery(getDb()).where(and(eq(productsT.id, id), eq(productsT.status, 'APPROVED')));
  const p = row && toProduct(row);
  return p && productSlug(p) === slug ? p : undefined;
}

/** A published listing by its slug, ended ones included (their page stays up with a notice; callers check isCurrent). Drafts and archived ones are not found. */
export async function getWorkshopBySlug(slug: string): Promise<Workshop | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^w\d+$/.test(id)) return undefined;
  const [row] = await workshopsQuery(getDb()).where(and(eq(workshopsT.id, id), eq(workshopsT.status, 'APPROVED')));
  const w = row && (await withPrices(getDb(), [toWorkshop(row)]))[0];
  return w && workshopSlug(w) === slug ? w : undefined;
}
