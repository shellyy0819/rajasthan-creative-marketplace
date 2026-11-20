import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories, products } from '../db/schema';
import { countProducts, listProducts } from './catalog';
import { SHOP_PAGE_SIZE } from './catalog-shared';
import type { Product } from './types';

/** A category that has a page: its name, its stable address part, and how many approved products it holds. */
export type CategoryEntry = { name: string; slug: string; count: number };

const withProducts = () => getDb()
  .select({ name: categories.name, slug: categories.slug, count: sql<number>`count(${products.id})::int` })
  .from(categories)
  .innerJoin(products, and(eq(products.category, categories.name), eq(products.status, 'APPROVED')))
  .groupBy(categories.id);

/** Categories that have at least one approved product (the only ones with a page), by name. */
export async function listCategoryIndex(): Promise<CategoryEntry[]> {
  const rows = await withProducts();
  return rows.sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
}

/** The category with this slug, or undefined when the slug is unknown or the category has no approved product. */
export async function getCategoryEntry(slug: string): Promise<CategoryEntry | undefined> {
  if (!slug) return undefined;
  const [row] = await withProducts().where(eq(categories.slug, slug));
  return row;
}

/** The page address part for a category name, or undefined when it has no page (used for links). */
export async function slugForCategory(name: string): Promise<string | undefined> {
  const [row] = await withProducts().where(eq(categories.name, name));
  return row?.slug;
}

/** One page of a category's products (exact category match), newest first, with the total and the number of pages. */
export async function listCategoryPage(entry: CategoryEntry, page: number): Promise<{ products: Product[]; total: number; pages: number }> {
  const [list, total] = await Promise.all([
    listProducts({ category: entry.name, limit: SHOP_PAGE_SIZE, offset: (Math.max(1, page) - 1) * SHOP_PAGE_SIZE }),
    countProducts({ category: entry.name }),
  ]);
  return { products: list, total, pages: Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE)) };
}
