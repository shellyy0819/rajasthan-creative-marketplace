import { HomeCraftExplorer } from './HomeCraftExplorer';
import { getHomeProducts } from '@/lib/home-cache';

/** Loads the home-page catalogue (cached for a minute, see home-cache) by itself so the page can stream it. */
export async function HomeShelf() {
  return <HomeCraftExplorer products={await getHomeProducts()} />;
}
