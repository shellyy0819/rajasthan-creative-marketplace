import { HomeCraftExplorer } from './HomeCraftExplorer';
import { getCatalogWording } from '@/lib/catalog-wording';
import { getHomeShelf } from '@/lib/home-cache';

/** Loads the home-page catalogue (first page and category counts, cached for a minute, see home-cache) by itself so the page can stream it. */
export async function HomeShelf() {
  const [{ items, categories }, wording] = await Promise.all([getHomeShelf(), getCatalogWording()]);
  return <HomeCraftExplorer initialItems={items} categories={categories} emptyMessage={`No ${wording.finds} yet. Check back soon.`} />;
}
