import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { SHOP_PAGE_SIZE } from './catalog-shared';
import { getCategoryEntry, listCategoryIndex, listCategoryPage, type CategoryEntry } from './category-pages';
import type { Product } from './types';

/**
 * Category-page data, shared across visitors for a minute instead of queried on every request (nothing here reads cookies or the session).
 * Product and category writes already call revalidatePath('/', 'layout'), which invalidates all cached data, so edits still show on the next visit.
 */
export const CATEGORY_TTL = 60;

const cachedEntry = unstable_cache(async (slug: string) => (await getCategoryEntry(slug)) ?? null, ['category-entry'], { revalidate: CATEGORY_TTL, tags: ['categories'] });
const cachedList = unstable_cache(async (slug: string, page: number) => {
  const entry = await getCategoryEntry(slug);
  return entry ? listCategoryPage(entry, page) : null;
}, ['category-list'], { revalidate: CATEGORY_TTL, tags: ['categories'] });
const cachedIndex = unstable_cache(() => listCategoryIndex(), ['category-index'], { revalidate: CATEGORY_TTL, tags: ['categories'] });

/** The category with this slug (undefined: unknown or no approved product). `cache` makes the page and its metadata share one lookup per request. */
export const loadCategoryEntry = cache(async (slug: string): Promise<CategoryEntry | undefined> => (await cachedEntry(slug)) ?? undefined);

/** A page of the category's products, or undefined for an unknown category or a page past the end (so a crawler cannot fill the cache with page numbers). */
export async function loadCategoryPage(entry: CategoryEntry, page: number): Promise<{ products: Product[]; total: number; pages: number } | undefined> {
  if (page > Math.max(1, Math.ceil(entry.count / SHOP_PAGE_SIZE))) return undefined;
  return (await cachedList(entry.slug, page)) ?? undefined;
}

/** Every category that has products, by name. */
export const loadCategoryIndex = cache(() => cachedIndex());
