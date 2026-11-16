import { and, eq, ne, not, notInArray, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../db/client';
import { productsQuery, toProduct } from '../db/mappers';
import { products } from '../db/schema';
import { artistIdPrefix } from './artist-slug';
import type { Product } from './types';

export const MAKER_LIMIT = 4;
export const SIMILAR_LIMIT = 8;
export type Related = { fromMaker: Product[]; similar: Product[] };

/** Makes `%`, `_` and `\` in a category name literal inside a LIKE pattern. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/**
 * A product's category matches when, ignoring case, either category name contains the other
 * ("Paintings" matches "Oil Paintings" and the other way round).
 */
const categoryMatches = (category: string): SQL => {
  const cur = category.toLowerCase();
  const colEscaped = sql`replace(replace(replace(lower(${products.category}), '\\', '\\\\'), '%', '\\%'), '_', '\\_')`;
  return sql`(lower(${products.category}) like ${'%' + likeLiteral(cur) + '%'} escape '\\' or ${cur}::text like '%' || ${colEscaped} || '%' escape '\\')`;
};

const newestFirst = [sql`length(${products.id}) desc`, sql`${products.id} desc`] as const;

/** More from the same maker, then similar products: matching category first, other categories to fill up. */
export async function getRelatedProducts(p: Product): Promise<Related> {
  const db = getDb();
  const prefix = artistIdPrefix(p.sellerSlug ?? '');
  const makerWhere = prefix ? sql`replace(${products.sellerId}::text, '-', '') like ${prefix + '%'}` : undefined;
  const base = [eq(products.status, 'APPROVED'), ne(products.id, p.id)];

  const fromMaker = makerWhere
    ? (await productsQuery(db).where(and(...base, makerWhere)).orderBy(...newestFirst)).map(toProduct)
        .filter(x => x.sellerSlug === p.sellerSlug).slice(0, MAKER_LIMIT)
    : [];

  const others = makerWhere ? [...base, not(makerWhere)] : base;
  const matching = (await productsQuery(db).where(and(...others, categoryMatches(p.category))).orderBy(...newestFirst).limit(SIMILAR_LIMIT)).map(toProduct);
  const filler = matching.length >= SIMILAR_LIMIT ? [] : (await productsQuery(db)
    .where(and(...others, not(categoryMatches(p.category)), ...(matching.length ? [notInArray(products.id, matching.map(x => x.id))] : [])))
    .orderBy(...newestFirst).limit(SIMILAR_LIMIT - matching.length)).map(toProduct);
  return { fromMaker, similar: [...matching, ...filler] };
}
