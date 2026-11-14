import { HomeCraftExplorer } from './HomeCraftExplorer';
import { listProducts } from '@/lib/catalog';

/** Loads the home-page catalogue by itself so the page can stream it behind a skeleton. */
export async function HomeShelf() {
  return <HomeCraftExplorer products={await listProducts()} />;
}
