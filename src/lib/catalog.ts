import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, sellerNameSql, toProduct, toWorkshop, workshopsQuery } from '../db/mappers';
import { products as productsT, workshops as workshopsT } from '../db/schema';
import { getCityByNameOrSlug } from './cities';
import { textSearch } from './search';
import { productSlug, workshopSlug } from './catalog-shared';
import type { Product, Workshop } from './types';

export { DEFAULT_CATEGORIES, citySlug, productSlug, workshopSlug } from './catalog-shared';

export type ProductFilter = { city?: string; category?: string; q?: string };
export type WorkshopFilter = { city?: string; type?: string; q?: string };

const anyCity = (c?: string) => !c || c === 'All India';
const idOrder = (t: { id: typeof productsT.id | typeof workshopsT.id }) => [sql`length(${t.id})`, asc(t.id)] as const;
const productDoc = sql`concat_ws(' ', ${productsT.name}, ${productsT.description}, ${sellerNameSql}, ${productsT.category})`;
const workshopDoc = sql`concat_ws(' ', ${workshopsT.title}, ${workshopsT.description}, ${workshopsT.venue}, ${workshopsT.hostName})`;

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const where: (SQL | undefined)[] = [eq(productsT.status, 'APPROVED')];
  if (!anyCity(f.city)) {
    const city = await getCityByNameOrSlug(f.city!);
    if (!city) return [];
    where.push(eq(productsT.cityId, city.id));
  }
  if (f.category && f.category !== 'All categories') where.push(eq(productsT.category, f.category));
  const search = textSearch(productDoc, f.q);
  where.push(search.where);
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
