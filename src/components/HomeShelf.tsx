import { HomeCraftExplorer } from './HomeCraftExplorer';
import { getHomeShelf } from '@/lib/home-cache';

/** Loads the home-page catalogue (first page and category counts, cached for a minute, see home-cache) by itself so the page can stream it. */
export async function HomeShelf() {
  const { items, categories } = await getHomeShelf();
  return <HomeCraftExplorer initialItems={items} categories={categories} />;
}
