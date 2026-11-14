import { unstable_cache } from 'next/cache';
import { listProducts } from './catalog';
import { trending } from './trending';

/**
 * Home-page data, shared across visitors instead of queried on every request. Nothing here reads the visitor's cookies or session.
 * Anything that changes what the public may see (product approve/unpublish/delete, workshop and profile edits, admin user
 * deactivate/delete) must call revalidatePath('/', 'layout'), which invalidates all cached data so the change shows on the next visit.
 * The TTL is only a backstop for a missed path and for the view/like-driven Trending ranking. A new route that hides content
 * must call it too, or the content can stay public here for up to the TTL.
 */
export const HOME_PRODUCTS_TTL = 60;
export const HOME_TRENDING_TTL = 300;

export const getHomeProducts = unstable_cache(() => listProducts(), ['home-products'], { revalidate: HOME_PRODUCTS_TTL, tags: ['home-products'] });
export const getHomeTrending = unstable_cache(() => trending({ limit: 6 }), ['home-trending'], { revalidate: HOME_TRENDING_TTL, tags: ['home-trending'] });
