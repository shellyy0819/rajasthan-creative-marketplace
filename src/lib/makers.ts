import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sellerNameSql } from '../db/mappers';
import { cities, products, sellerProfiles, users } from '../db/schema';
import { artistSlug } from './artist-slug';
import { publicLogo } from './public-logo';

/** What the home-page makers carousel shows for one maker. Only the name and the shop link are always present. */
export type HomeMaker = { slug: string; name: string; /** Every category the maker has a published product in, A to Z. */ categories: string[]; city?: string; quote?: string; logoUrl?: string };

export const MAKERS_ON_HOME = 8;
export const MAKER_QUOTE_MAX = 140;

/** One short line from the maker's bio: its first sentence, cut at a word boundary when it is longer than MAKER_QUOTE_MAX. */
export function makerQuote(bio: string | null | undefined): string | undefined {
  const text = (bio ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  const first = /^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
  if (first.length <= MAKER_QUOTE_MAX) return first;
  return `${first.slice(0, MAKER_QUOTE_MAX).replace(/\s+\S*$/, '')}…`;
}

/** Active makers with at least one published product (the same rule that makes their artist page exist), by name. */
export async function listHomeMakers(limit = MAKERS_ON_HOME): Promise<HomeMaker[]> {
  const rows = await getDb()
    .select({ id: users.id, name: sellerNameSql, city: cities.name, bio: sellerProfiles.bio, logoUrl: sellerProfiles.logoUrl })
    .from(sellerProfiles)
    .innerJoin(users, eq(users.id, sellerProfiles.userId))
    .leftJoin(cities, eq(cities.id, sellerProfiles.cityId))
    .where(and(eq(users.active, true), sql`exists (select 1 from products where products.seller_id = ${users.id} and products.status = 'APPROVED')`))
    .orderBy(asc(sellerNameSql), asc(users.id))
    .limit(limit);
  const sold = rows.length
    ? await getDb().select({ sellerId: products.sellerId, category: products.category }).from(products)
      .where(and(inArray(products.sellerId, rows.map(r => r.id)), eq(products.status, 'APPROVED')))
      .groupBy(products.sellerId, products.category).orderBy(asc(products.category))
    : [];
  return rows.map(r => {
    const quote = makerQuote(r.bio);
    return {
      slug: artistSlug(r.name, r.id), name: r.name, categories: sold.filter(c => c.sellerId === r.id).map(c => c.category),
      ...(r.city ? { city: r.city } : {}), ...(quote ? { quote } : {}),
      ...(r.logoUrl && publicLogo(r.id, r.logoUrl) ? { logoUrl: r.logoUrl } : {}),
    };
  });
}
