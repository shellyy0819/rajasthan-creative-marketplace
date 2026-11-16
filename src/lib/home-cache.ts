import { unstable_cache } from 'next/cache';
import { countProductsByCategory, listProducts } from './catalog';
import { SHELF_PAGE_SIZE } from './catalog-shared';
import { listHomeMakers } from './makers';
import { trending } from './trending';

/**
 * Home-page data, shared across visitors instead of queried on every request. Nothing here reads the visitor's cookies or session.
 * Every product/workshop/profile write already calls revalidatePath('/', 'layout'), which invalidates all cached data, so changes
 * still show on the next visit; the TTL only bounds how stale the view/like-driven Trending row can get.
 */
export const HOME_PRODUCTS_TTL = 60;
export const HOME_TRENDING_TTL = 300;

/** The home shelf's first page plus its category tabs. Later pages come from /api/products as the visitor scrolls. */
export const getHomeShelf = unstable_cache(
  async () => ({ items: await listProducts({ limit: SHELF_PAGE_SIZE }), categories: await countProductsByCategory() }),
  ['home-shelf'], { revalidate: HOME_PRODUCTS_TTL, tags: ['home-products'] },
);
export const getHomeTrending = unstable_cache(() => trending({ limit: 6 }), ['home-trending'], { revalidate: HOME_TRENDING_TTL, tags: ['home-trending'] });
export const getHomeMakers = unstable_cache(() => listHomeMakers(), ['home-makers'], { revalidate: HOME_PRODUCTS_TTL, tags: ['home-makers'] });
