import { unstable_cache } from 'next/cache';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { products, sourcingTypes } from '../db/schema';

/** How the site may describe what it sells right now: built from the sourcing types of the published products, never typed by hand. */
export type CatalogWording = {
  /** "handmade", "handmade and curated", "handmade, curated and resold", or "" when nothing can be claimed. */
  adjective: string;
  /** "handmade products" or just "products". */
  products: string;
  /** "handmade finds" or just "finds". */
  finds: string;
  /** A sourcing type that counts as handmade and has published products (the shop filter behind "Explore Handmade"), if any. */
  handmadeType?: string;
  stats: { products: number; makers: number; cities: number };
};

export const NEUTRAL_WORDING: CatalogWording = { adjective: '', products: 'products', finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } };

export const joinWords = (w: string[]): string => (w.length <= 1 ? (w[0] ?? '') : `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`);
export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

type TypeUse = { name: string; countsAsHandmade: boolean; count: number };

/**
 * Pure rule. Each published product's sourcing type is named in the wording ("handmade", "curated"...). A product with no type set
 * cannot be described, so while any exists the site claims nothing and falls back to plain "products".
 */
export function describeCatalog(types: TypeUse[], untyped: number, stats: CatalogWording['stats']): CatalogWording {
  const used = types.filter(t => t.count > 0);
  const adjective = untyped > 0 ? '' : joinWords(used.map(t => t.name.trim().toLowerCase()));
  const handmade = used.find(t => t.countsAsHandmade);
  return {
    adjective,
    products: adjective ? `${adjective} products` : 'products',
    finds: adjective ? `${adjective} finds` : 'finds',
    ...(handmade ? { handmadeType: handmade.name } : {}),
    stats,
  };
}

export async function loadCatalogWording(): Promise<CatalogWording> {
  const db = getDb();
  const published = eq(products.status, 'APPROVED');
  const [types, [untyped], [stats]] = await Promise.all([
    db.select({ name: sourcingTypes.name, countsAsHandmade: sourcingTypes.countsAsHandmade, count: sql<number>`count(${products.id})::int` })
      .from(products).innerJoin(sourcingTypes, eq(sourcingTypes.id, products.sourcingTypeId)).where(published)
      .groupBy(sourcingTypes.id).orderBy(sourcingTypes.position),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(and(published, isNull(products.sourcingTypeId))),
    db.select({ products: sql<number>`count(*)::int`, makers: sql<number>`count(distinct ${products.sellerId})::int`, cities: sql<number>`count(distinct ${products.cityId})::int` })
      .from(products).where(published),
  ]);
  return describeCatalog(types, untyped.n, stats);
}

/**
 * Cached, and cleared by the same revalidatePath('/', 'layout') that every admin and seller save already calls, so the wording follows
 * the catalogue as soon as it changes. The time limit is only a safety net.
 */
export const getCatalogWording = unstable_cache(loadCatalogWording, ['catalog-wording'], { revalidate: 300, tags: ['data-version'] });

/** The site-wide tagline and meta description, worded for what is actually on sale. */
export const siteCopy = (w: CatalogWording) => ({
  tagline: `${capitalize(w.products)} from Indian artisans`,
  description: `Discover ${w.products} from independent artisans across India and book creative workshops. Contact makers directly to order.`,
});
