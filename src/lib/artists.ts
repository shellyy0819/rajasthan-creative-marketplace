import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products, sellerProfiles, users } from '../db/schema';
import { artistIdPrefix, artistSlug } from './artist-slug';
import type { Product } from './types';

export type Artist = { name: string; slug: string; phone?: string; email?: string; instagram?: string; youtube?: string; products: Product[] };

/** Public artist page data. Undefined unless the artist has at least one published product and the slug is exactly current. */
export async function getArtist(slug: string): Promise<Artist | undefined> {
  const prefix = artistIdPrefix(slug);
  if (!prefix) return undefined;
  const db = getDb();
  const candidates = await db.select({ id: users.id }).from(users).where(sql`replace(${users.id}::text, '-', '') like ${prefix + '%'}`).orderBy(asc(users.id));
  for (const { id } of candidates) {
    const rows = await productsQuery(db).where(and(eq(products.sellerId, id), eq(products.status, 'APPROVED'))).orderBy(sql`length(${products.id}) desc`, sql`${products.id} desc`);
    if (!rows.length) continue;
    const name = rows[0].sellerName;
    if (artistSlug(name, id) !== slug) continue;
    const [pf] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, id));
    return {
      name, slug,
      ...(pf?.publicPhone ? { phone: pf.publicPhone } : {}), ...(pf?.publicEmail ? { email: pf.publicEmail } : {}),
      ...(pf?.instagram ? { instagram: pf.instagram } : {}), ...(pf?.youtube ? { youtube: pf.youtube } : {}),
      products: rows.map(toProduct),
    };
  }
  return undefined;
}
