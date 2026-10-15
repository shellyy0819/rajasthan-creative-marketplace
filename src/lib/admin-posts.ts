import { and, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { toProduct } from '../db/mappers';
import { products } from '../db/schema';
import { artistKey } from './artist';
import { ApiError } from './errors';
import type { Product } from './types';

export { artistKey };
export type AdminArtist = { key: string; name: string; total: number; published: number; drafts: number; archived?: number };
export type AdminProductQuery = { artist?: string; status?: string; q?: string };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);
// Same normalisation as artistKey(): collapse whitespace, trim, lowercase.
const cleanSeller = sql`btrim(regexp_replace(${products.seller}, '\\s+', ' ', 'g'))`;
const keySql = sql`lower(${cleanSeller})`;

export async function listProductsForAdmin(f: AdminProductQuery = {}): Promise<Product[]> {
  const where: SQL[] = [];
  if (f.artist) where.push(sql`${keySql} = ${artistKey(f.artist)}`);
  if (f.status) where.push(eq(products.status, f.status));
  const q = (f.q ?? '').trim();
  if (q) where.push(ilike(sql`concat_ws(' ', ${products.name}, ${products.description}, ${products.seller}, ${products.category})`, `%${escapeLike(q)}%`));
  const rows = await getDb().select().from(products).where(and(...where))
    .orderBy(sql`length(${products.id}) desc`, sql`${products.id} desc`);
  return rows.map(toProduct);
}

export async function getProductForAdmin(id: string): Promise<Product> {
  const [row] = await getDb().select().from(products).where(eq(products.id, id));
  if (!row) throw new ApiError(404, 'Product not found.');
  return toProduct(row);
}

export async function listArtists(): Promise<AdminArtist[]> {
  const rows = await getDb().select({
    key: sql<string>`${keySql}`,
    // label = the first-created post's seller text (same rule as before)
    name: sql<string>`(array_agg(${cleanSeller} order by length(${products.id}), ${products.id}))[1]`,
    total: sql<number>`count(*)`.mapWith(Number),
    published: sql<number>`count(*) filter (where ${products.status} = 'APPROVED')`.mapWith(Number),
    drafts: sql<number>`count(*) filter (where ${products.status} = 'DRAFT')`.mapWith(Number),
    archived: sql<number>`count(*) filter (where ${products.status} = 'ARCHIVED')`.mapWith(Number),
  }).from(products).groupBy(keySql);
  return rows
    .map(r => ({ key: r.key, name: r.name, total: r.total, published: r.published, drafts: r.drafts, archived: r.archived }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
