import { ProductGrid } from './ProductGrid';
import { getHomeShelf } from '@/lib/home-cache';

/**
 * A short, fixed taste of the catalogue (the "Browse & filter all" link next to it opens /shop). No category tabs and no scrolling for more here:
 * filtering and paging live on /shop. Loaded by itself (cached for a minute, see home-cache) so the page can stream it.
 */
export async function HomeShelf() {
  return <ProductGrid products={await getHomeShelf()} emptyMessage="No finds yet. Check back soon." />;
}
