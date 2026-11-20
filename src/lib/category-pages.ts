import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { categories, products } from '../db/schema';
import { countProducts, listProducts } from './catalog';
import { SHOP_PAGE_SIZE } from './catalog-shared';
import { ApiError } from './errors';
import type { Product } from './types';
import { bad, obj } from './validate';

/** A category that has a page: its name, its stable address part, its description (empty = none written yet) and how many approved products it holds. */
export type CategoryEntry = { name: string; slug: string; description: string; count: number };

export const MAX_CATEGORY_DESCRIPTION = 600;

const withProducts = () => getDb()
  .select({ name: categories.name, slug: categories.slug, description: categories.description, count: sql<number>`count(${products.id})::int` })
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

/** One page of a category's products (exact category match), in the same order as /shop, with the total and the number of pages. */
export async function listCategoryPage(entry: CategoryEntry, page: number): Promise<{ products: Product[]; total: number; pages: number }> {
  const [list, total] = await Promise.all([
    listProducts({ category: entry.name, limit: SHOP_PAGE_SIZE, offset: (Math.max(1, page) - 1) * SHOP_PAGE_SIZE }),
    countProducts({ category: entry.name }),
  ]);
  return { products: list, total, pages: Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE)) };
}

/** The text shown above a category's products and used as its meta description: its own description when an admin wrote one, a generic line otherwise. */
export function categoryIntro(entry: CategoryEntry, productsWord: string): string {
  return entry.description || `Browse ${entry.count} ${productsWord} in ${entry.name} from independent makers across India. Contact the maker directly to order.`;
}

/** Admin: set (or, with an empty text, clear) a category's description. 400 for a non-text, a control character or a text over the limit; 404 for an unknown slug. */
export async function setCategoryDescription(slug: string, value: unknown): Promise<{ slug: string; description: string }> {
  if (typeof value !== 'string') throw bad('description must be text.');
  if (/\p{Cc}/u.test(value.replace(/\s/g, ' '))) throw bad('description must not contain control characters.');
  const description = value.replace(/\s+/g, ' ').trim();
  if (description.length > MAX_CATEGORY_DESCRIPTION) throw bad(`description must be up to ${MAX_CATEGORY_DESCRIPTION} characters.`);
  const [row] = await getDb().update(categories).set({ description }).where(eq(categories.slug, slug)).returning({ slug: categories.slug, description: categories.description });
  if (!row) throw new ApiError(404, 'Category not found.');
  return row;
}

/** Reads `description` from an API body. */
export const descriptionOf = (input: unknown): unknown => obj(input).description;

/** When each category's page last changed (its newest product edit), by slug: for the sitemap's lastmod. */
export async function listCategoryLastModified(): Promise<Record<string, Date>> {
  const rows = await getDb()
    .select({ slug: categories.slug, at: sql<Date>`max(${products.updatedAt})` })
    .from(categories)
    .innerJoin(products, and(eq(products.category, categories.name), eq(products.status, 'APPROVED')))
    .groupBy(categories.id);
  return Object.fromEntries(rows.map(r => [r.slug, new Date(r.at)]));
}
