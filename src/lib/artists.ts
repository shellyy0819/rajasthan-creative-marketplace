import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, publicPhoneOf, toProduct, toWorkshop, withPrices, workshopsQuery } from '../db/mappers';
import { cities, products, sellerProfiles, users, workshops as workshopsT } from '../db/schema';
import { artistIdPrefix, artistSlug } from './artist-slug';
import { publicLogo } from './public-logo';
import type { Product, Workshop } from './types';
import { isCurrent } from './workshop-listing';

export type Artist = { name: string; slug: string; phone?: string; email?: string; instagram?: string; youtube?: string; bio?: string; logoUrl?: string; city?: string; cityId?: number; products: Product[];
  /** Classes and workshops this person hosts that are still on (not ended). Empty for a maker who only sells. */
  workshops?: Workshop[] };

/** Public profile data for a maker, an instructor or a host: one page per person. Undefined unless they have at least one published product or published class or workshop (an ended one counts, so a link from its page still works) and the slug is exactly current. */
export async function getArtist(slug: string): Promise<Artist | undefined> {
  const prefix = artistIdPrefix(slug);
  if (!prefix) return undefined;
  const db = getDb();
  const candidates = await db.select({ id: users.id }).from(users).where(sql`replace(${users.id}::text, '-', '') like ${prefix + '%'}`).orderBy(asc(users.id));
  for (const { id } of candidates) {
    const rows = await productsQuery(db).where(and(eq(products.sellerId, id), eq(products.status, 'APPROVED'))).orderBy(sql`length(${products.id}) desc`, sql`${products.id} desc`);
    const hosted = await workshopsQuery(db).where(and(eq(workshopsT.hostId, id), eq(workshopsT.status, 'APPROVED'))).orderBy(asc(workshopsT.startsAt));
    if (!rows.length && !hosted.length) continue;
    const name = rows[0]?.sellerName ?? hosted[0].hostProfileName ?? hosted[0].w.hostName;
    if (artistSlug(name, id) !== slug) continue;
    const [pf] = await db.select({ pf: sellerProfiles, cityName: cities.name }).from(sellerProfiles)
      .leftJoin(cities, eq(cities.id, sellerProfiles.cityId)).where(eq(sellerProfiles.userId, id))
      .then(r => r.map(x => ({ ...x.pf, cityName: x.cityName })));
    return {
      name, slug,
      ...(publicPhoneOf(pf?.publicPhone, pf?.contactMethods) ? { phone: publicPhoneOf(pf?.publicPhone, pf?.contactMethods)! } : {}), ...(pf?.publicEmail ? { email: pf.publicEmail } : {}),
      ...(pf?.instagram ? { instagram: pf.instagram } : {}), ...(pf?.youtube ? { youtube: pf.youtube } : {}),
      ...(pf?.bio ? { bio: pf.bio } : {}), ...(pf?.logoUrl && publicLogo(id, pf.logoUrl) ? { logoUrl: pf.logoUrl } : {}), ...(pf?.cityName ? { city: pf.cityName, cityId: pf.cityId! } : {}),
      products: rows.map(toProduct),
      workshops: (await withPrices(db, hosted.map(toWorkshop))).filter(w => isCurrent(w)),
    };
  }
  return undefined;
}
