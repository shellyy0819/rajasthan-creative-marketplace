import type { Product } from '@/lib/types';
import { ProductCard } from './ProductCard';

/** `loading`: results are on their way, so an empty grid is not yet "nothing found" and the message is held back (the page shows its loader instead). */
export function ProductGrid({ products, emptyMessage = 'No finds match those filters. Try another city or search.', loading = false }: { products: Product[]; emptyMessage?: string; loading?: boolean }) {
  if (!products.length && loading) return <div className="product-grid" />;
  if (!products.length) return <div className="product-grid"><div className="empty">{emptyMessage}</div></div>;
  return <div className="product-grid">{products.map((p, i) => <ProductCard key={p.id} p={p} eager={i < 4} />)}</div>;
}
