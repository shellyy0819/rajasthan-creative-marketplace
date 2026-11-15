import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, sellerNameSql, toProduct, toWorkshop, workshopsQuery } from '../db/mappers';
import { products as productsT, sourcingTypes, workshops as workshopsT } from '../db/schema';
import { getCityByNameOrSlug } from './cities';
import { normalizeQuery, textSearch } from './search';
import { productSlug, workshopSlug } from './catalog-shared';
import type { Product, Workshop } from './types';

export { DEFAULT_CATEGORIES, productSlug, workshopSlug } from './catalog-shared';

export type ProductFilter = { city?: string; category?: string; source?: string; q?: string };
export type WorkshopFilter = { city?: string; type?: string; q?: string };

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

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const where: (SQL | undefined)[] = [eq(productsT.status, 'APPROVED')];
  if (!anyCity(f.city)) {
    const city = await getCityByNameOrSlug(f.city!);
    if (!city) return [];
    where.push(eq(productsT.cityId, city.id));
  }
  if (f.category && f.category !== 'All categories') where.push(eq(productsT.category, f.category));
  const scope = await sourcingScope(f);
  const search = textSearch(productDoc, scope.q);
  // A product with no sourcing type (null) never matches the type itself.
  const ofType = scope.source ? sql`${productsT.sourcingTypeId} in (select id from sourcing_types where lower(name) = ${scope.source.toLowerCase()})` : undefined;
  if (ofType && scope.orText && search.where) where.push(or(ofType, search.where));
  else { if (ofType) where.push(ofType); where.push(search.where); }
  const rows = await productsQuery(getDb()).where(and(...where)).orderBy(...(search.rank ? [desc(search.rank)] : []), ...idOrder(productsT));
  return rows.map(toProduct);
}

export async function listWorkshops(f: WorkshopFilter = {}): Promise<Workshop[]> {
  const where: (SQL | undefined)[] = [eq(workshopsT.status, 'APPROVED')];
  if (!anyCity(f.city)) {
    const city = await getCityByNameOrSlug(f.city!);
    if (!city) return [];
    where.push(eq(workshopsT.cityId, city.id));
  }
  if (f.type && f.type !== 'ALL') where.push(eq(workshopsT.type, f.type));
  const search = textSearch(workshopDoc, f.q);
  where.push(search.where);
  const rows = await workshopsQuery(getDb()).where(and(...where)).orderBy(...(search.rank ? [desc(search.rank)] : []), ...idOrder(workshopsT));
  return rows.map(toWorkshop);
}

/** slug = "<name>-<id>": look the id up directly, then require the exact slug (wrong name part → undefined). */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^p\d+$/.test(id)) return undefined;
  const [row] = await productsQuery(getDb()).where(and(eq(productsT.id, id), eq(productsT.status, 'APPROVED')));
  const p = row && toProduct(row);
  return p && productSlug(p) === slug ? p : undefined;
}

export async function getWorkshopBySlug(slug: string): Promise<Workshop | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^w\d+$/.test(id)) return undefined;
  const [row] = await workshopsQuery(getDb()).where(and(eq(workshopsT.id, id), eq(workshopsT.status, 'APPROVED')));
  const w = row && toWorkshop(row);
  return w && workshopSlug(w) === slug ? w : undefined;
}
