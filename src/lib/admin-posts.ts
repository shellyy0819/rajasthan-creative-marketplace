import { and, desc, eq, inArray, notExists, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, sellerNameSql, toAdminProduct } from '../db/mappers';
import { ROLE_ID } from '../db/people';
import { products, sellerProfiles, userRoles, users, workshops } from '../db/schema';
import { artistKey } from './artist';
import type { Role } from './authz';
import { ApiError } from './errors';
import { textSearch } from './search';
import type { AdminProduct } from './types';

export { artistKey };
export type AdminArtist = { key: string; name: string; total: number; published: number; drafts: number; archived?: number;
  /** An active maker who has posted no product and no workshop yet. Admin view only; `email` tells same-named makers apart. */
  noPosts?: boolean; email?: string };
export type AdminProductQuery = { artist?: string; status?: string; q?: string };

/** A seller sees only their own products; admins are unscoped. Routes always pass scopeFor(user). */
export type Scope = { sellerEmail?: string };
export const scopeFor = (u: { email: string; role: Role }): Scope => (u.role === 'admin' ? {} : { sellerEmail: u.email });
const scopeWhere = (s: Scope): SQL[] => (s.sellerEmail ? [sql`lower(${users.email}) = ${s.sellerEmail.toLowerCase()}`] : []);

// "Artist" = the seller's public name. Same normalisation as artistKey(): collapse whitespace, trim, lowercase.
const cleanSeller = sql`btrim(regexp_replace(${sellerNameSql}, '\\s+', ' ', 'g'))`;
const keySql = sql`lower(${cleanSeller})`;
const docSql = sql`concat_ws(' ', ${products.name}, ${products.description}, ${sellerNameSql}, ${products.category})`;

export async function listProductsForAdmin(f: AdminProductQuery = {}, scope: Scope = {}): Promise<AdminProduct[]> {
  const where: (SQL | undefined)[] = scopeWhere(scope);
  if (f.artist) where.push(sql`${keySql} = ${artistKey(f.artist)}`);
  if (f.status) where.push(eq(products.status, f.status));
  const search = textSearch(docSql, f.q);
  where.push(search.where);
  const rows = await productsQuery(getDb()).where(and(...where))
    .orderBy(...(search.rank ? [desc(search.rank)] : []), sql`length(${products.id}) desc`, sql`${products.id} desc`);
  return rows.map(toAdminProduct);
}

export async function getProductForAdmin(id: string, scope: Scope = {}): Promise<AdminProduct> {
  const [row] = await productsQuery(getDb()).where(and(eq(products.id, id), ...scopeWhere(scope)));
  if (!row) throw new ApiError(404, 'Product not found.');
  return toAdminProduct(row);
}

export async function listArtists(scope: Scope = {}): Promise<AdminArtist[]> {
  const rows = await getDb().select({
    key: sql<string>`${keySql}`,
    // label = the first-created post's seller name
    name: sql<string>`(array_agg(${cleanSeller} order by length(${products.id}), ${products.id}))[1]`,
    total: sql<number>`count(*)`.mapWith(Number),
    published: sql<number>`count(*) filter (where ${products.status} = 'APPROVED')`.mapWith(Number),
    drafts: sql<number>`count(*) filter (where ${products.status} = 'DRAFT')`.mapWith(Number),
    archived: sql<number>`count(*) filter (where ${products.status} = 'ARCHIVED')`.mapWith(Number),
  }).from(products)
    .innerJoin(users, eq(users.id, products.sellerId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(and(...scopeWhere(scope)))
    .groupBy(keySql);
  const posted: AdminArtist[] = rows.map(r => ({ key: r.key, name: r.name, total: r.total, published: r.published, drafts: r.drafts, archived: r.archived }));
  // A seller sees only their own posts; the flag is for the admin's view of every maker.
  const quiet = scope.sellerEmail ? [] : await listMakersWithoutPosts();
  return [...posted, ...quiet].sort((a, b) => a.name.localeCompare(b.name) || (a.email ?? '').localeCompare(b.email ?? ''));
}

/**
 * Active sellers who have not posted anything: no product of theirs, and no workshop linked to their account or
 * carrying their email as its private contact (the same test as the seller's own "My workshops" list).
 */
async function listMakersWithoutPosts(): Promise<AdminArtist[]> {
  const db = getDb();
  const rows = await db.selectDistinct({ id: users.id, name: sellerNameSql, email: users.email }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.roleId, ROLE_ID.seller)))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(and(
      eq(users.active, true),
      notExists(db.select({ one: sql`1` }).from(products).where(eq(products.sellerId, users.id))),
      notExists(db.select({ one: sql`1` }).from(workshops).where(sql`${workshops.hostId} = ${users.id} or lower(${workshops.contactEmail}) = lower(${users.email})`)),
    ));
  return rows.map(r => ({ key: `no-posts:${r.id}`, name: r.name.replace(/\s+/g, ' ').trim(), total: 0, published: 0, drafts: 0, noPosts: true, email: r.email }));
}

/** For the product form's workshop dropdown (every workshop, any status). */
export async function listWorkshopOptions(): Promise<{ id: string; title: string }[]> {
  const rows = await getDb().select({ id: workshops.id, title: workshops.title }).from(workshops).orderBy(sql`length(${workshops.id})`, workshops.id);
  return rows;
}

/** Users who can own products (seller or admin role, active), for the admin's seller picker. */
export type SellerOption = { id: string; name: string; email: string; phone?: string };
export async function listSellerOptions(): Promise<SellerOption[]> {
  const rows = await getDb().selectDistinct({ id: users.id, name: sellerNameSql, email: users.email, phone: sellerProfiles.publicPhone }).from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), inArray(userRoles.roleId, [ROLE_ID.seller, ROLE_ID.admin])))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(eq(users.active, true));
  return rows.map(r => ({ id: r.id, name: r.name, email: r.email, ...(r.phone ? { phone: r.phone } : {}) }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}
