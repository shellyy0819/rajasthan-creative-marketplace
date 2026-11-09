import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { cities, products, sellerProfiles, users } from '../db/schema';
import { artistIdPrefix, artistSlug } from './artist-slug';
import { isHttpUrl } from './onboarding-validate';
import { isOwnLogoUrl, storageConfig } from './storage';
import type { Product } from './types';

export type Artist = { name: string; slug: string; phone?: string; email?: string; instagram?: string; youtube?: string; bio?: string; logoUrl?: string; city?: string; cityId?: number; products: Product[] };

/** A stored logo is shown only if it is an http(s) link and, when uploads are configured, one of the maker's own files in our storage (the rule it was written under). */
function publicLogo(userId: string, url: string): boolean {
  if (!isHttpUrl(url)) return false;
  const cfg = storageConfig();
  return cfg ? isOwnLogoUrl(cfg, userId, url) : true;
}

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
    const [pf] = await db.select({ pf: sellerProfiles, cityName: cities.name }).from(sellerProfiles)
      .leftJoin(cities, eq(cities.id, sellerProfiles.cityId)).where(eq(sellerProfiles.userId, id))
      .then(r => r.map(x => ({ ...x.pf, cityName: x.cityName })));
    return {
      name, slug,
      ...(pf?.publicPhone ? { phone: pf.publicPhone } : {}), ...(pf?.publicEmail ? { email: pf.publicEmail } : {}),
      ...(pf?.instagram ? { instagram: pf.instagram } : {}), ...(pf?.youtube ? { youtube: pf.youtube } : {}),
      ...(pf?.bio ? { bio: pf.bio } : {}), ...(pf?.logoUrl && publicLogo(id, pf.logoUrl) ? { logoUrl: pf.logoUrl } : {}), ...(pf?.cityName ? { city: pf.cityName, cityId: pf.cityId! } : {}),
      products: rows.map(toProduct),
    };
  }
  return undefined;
}
