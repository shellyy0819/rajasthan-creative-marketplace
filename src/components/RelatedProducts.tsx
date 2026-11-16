import Link from 'next/link';
import type { Product } from '@/lib/types';
import { getRelatedProducts } from '@/lib/related-products';
import { ProductGrid } from './ProductGrid';

/** Under a product: more from the same maker, then similar products. A section with nothing to show is left out. */
export async function RelatedProducts({ product }: { product: Product }) {
  const { fromMaker, similar } = await getRelatedProducts(product);
  if (!fromMaker.length && !similar.length) return null;
  return (
    <>
      {similar.length > 0 && (
        <section className="section" aria-labelledby="similar-h">
          <div className="section-heading">
            <div><span className="eyebrow">YOU MAY ALSO LIKE</span><h2 id="similar-h">Similar products</h2></div>
            <Link className="text-link" href={`/shop?category=${encodeURIComponent(product.category)}`}>See all {product.category} →</Link>
          </div>
          <ProductGrid products={similar} />
        </section>
      )}
      {fromMaker.length > 0 && (
        <section className="section" aria-labelledby="more-maker-h">
          <div className="section-heading">
            <div><span className="eyebrow">FROM THE SAME MAKER</span><h2 id="more-maker-h">More from {product.seller}</h2></div>
            {product.sellerSlug && <Link className="text-link" href={`/artists/${product.sellerSlug}`}>View all →</Link>}
          </div>
          <ProductGrid products={fromMaker} />
        </section>
      )}
    </>
  );
}
