import { and, asc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toProduct, toWorkshop } from '../db/mappers';
import { products as productsT, workshops as workshopsT } from '../db/schema';
import { productSlug, workshopSlug } from './catalog-shared';
import type { Product, Workshop } from './types';

export { CITIES, CATEGORIES, citySlug, cityFromSlug, productSlug, workshopSlug } from './catalog-shared';

export type ProductFilter = { city?: string; category?: string; q?: string };
export type WorkshopFilter = { city?: string; type?: string; q?: string };

const anyCity = (c?: string) => !c || c === 'All Rajasthan';
/** Escape LIKE metacharacters so user text is matched literally (backslash is Postgres' default LIKE escape). */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);
const idOrder = (t: { id: typeof productsT.id | typeof workshopsT.id }) => [sql`length(${t.id})`, asc(t.id)] as const;

export async function listProducts(f: ProductFilter = {}): Promise<Product[]> {
  const where: SQL[] = [eq(productsT.status, 'APPROVED')];
  if (!anyCity(f.city)) where.push(eq(productsT.city, f.city!));
  if (f.category && f.category !== 'All categories') where.push(eq(productsT.category, f.category));
  if (f.q) where.push(ilike(sql`concat_ws(' ', ${productsT.name}, ${productsT.description}, ${productsT.seller}, ${productsT.category})`, `%${escapeLike(f.q)}%`));
  const rows = await getDb().select().from(productsT).where(and(...where)).orderBy(...idOrder(productsT));
  return rows.map(toProduct);
}

export async function listWorkshops(f: WorkshopFilter = {}): Promise<Workshop[]> {
  const where: SQL[] = [eq(workshopsT.status, 'APPROVED')];
  if (!anyCity(f.city)) where.push(eq(workshopsT.city, f.city!));
  if (f.type && f.type !== 'ALL') where.push(eq(workshopsT.type, f.type));
  if (f.q) where.push(ilike(sql`concat_ws(' ', ${workshopsT.title}, ${workshopsT.description}, ${workshopsT.venue}, ${workshopsT.host})`, `%${escapeLike(f.q)}%`));
  const rows = await getDb().select().from(workshopsT).where(and(...where)).orderBy(...idOrder(workshopsT));
  return rows.map(toWorkshop);
}

/** slug = "<name>-<id>": look the id up directly, then require the exact slug (wrong name part → undefined). */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^p\d+$/.test(id)) return undefined;
  const [row] = await getDb().select().from(productsT).where(and(eq(productsT.id, id), eq(productsT.status, 'APPROVED')));
  const p = row && toProduct(row);
  return p && productSlug(p) === slug ? p : undefined;
}

export async function getWorkshopBySlug(slug: string): Promise<Workshop | undefined> {
  const id = slug.slice(slug.lastIndexOf('-') + 1);
  if (!/^w\d+$/.test(id)) return undefined;
  const [row] = await getDb().select().from(workshopsT).where(and(eq(workshopsT.id, id), eq(workshopsT.status, 'APPROVED')));
  const w = row && toWorkshop(row);
  return w && workshopSlug(w) === slug ? w : undefined;
}
