import { unstable_cache } from 'next/cache';
import { listProducts } from './catalog';
import { getHomeSettings } from './home-settings';
import { trending } from './trending';
import { HOME_WORKSHOPS, trendingWorkshops } from './trending-workshops';

/**
 * Home-page data, shared across visitors instead of queried on every request. Nothing here reads the visitor's cookies or session.
 * Every product/workshop/profile write already calls revalidatePath('/', 'layout'), which invalidates all cached data, so changes
 * still show on the next visit; the TTL only bounds how stale the view/like-driven Trending row can get.
 */
export const HOME_PRODUCTS_TTL = 60;
export const HOME_TRENDING_TTL = 300;

/** The products on the home shelf: as many as the admin set (Settings > Home page). The rest, with filters and paging, is /shop. Saving the setting revalidates this cache. */
export const getHomeShelf = unstable_cache(
  async () => listProducts({ limit: (await getHomeSettings()).productLimit }),
  ['home-shelf'], { revalidate: HOME_PRODUCTS_TTL, tags: ['home-products'] },
);
export const getHomeTrending = unstable_cache(() => trending({ limit: 6 }), ['home-trending'], { revalidate: HOME_TRENDING_TTL, tags: ['home-trending'] });
export const getHomeTrendingWorkshops = unstable_cache(() => trendingWorkshops({ limit: HOME_WORKSHOPS }), ['home-trending-workshops'], { revalidate: HOME_TRENDING_TTL, tags: ['home-trending'] });
