import type { Product } from '@/lib/types';
import { ProductCard } from './ProductCard';

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <div className="product-grid"><div className="empty">No finds match those filters. Try another city or search.</div></div>;
  return <div className="product-grid">{products.map(p => <ProductCard key={p.id} p={p} />)}</div>;
}
