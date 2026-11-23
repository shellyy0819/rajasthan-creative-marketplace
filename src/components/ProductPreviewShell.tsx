'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ProductImage } from './ProductImage';
import { ProductPlaceholder } from './ProductPlaceholder';
import { readPreview, type ProductPreview } from '@/lib/product-preview';
import { money } from '@/lib/money';

/**
 * The product page's frame while the page loads: the same grid as the real page, filled with what the clicked card already knew
 * (photo, category, title, price, maker) and placeholders for the rest. Without a card (a direct visit) it is all placeholders.
 * The card's data is read after the first paint, so the server and browser render the same thing and nothing mismatches.
 */
export function ProductPreviewShell() {
  const path = usePathname();
  const [pv, setPv] = useState<ProductPreview | undefined>();
  useEffect(() => { setPv(readPreview(path)); }, [path]);
  return (
    <article className="detail" aria-busy="true">
      <p className="sr-only" role="status">Loading product</p>
      <div className="gallery">
        <div className={`product-visual detail-art visual-${(pv?.variant ?? 0) % 4}`}>
          {pv?.imageUrl
            ? <ProductImage src={pv.imageUrl} alt={pv.name} fallback={<ProductPlaceholder />} eager sizes="(max-width: 900px) 100vw, 640px" />
            : pv ? <ProductPlaceholder /> : <span className="skeleton product-preview-fill" aria-hidden="true" />}
        </div>
      </div>
      <div>
        {pv ? (
          <>
            <span className="product-meta">{pv.category}</span>
            <h1>{pv.name}</h1>
            <p className="detail-price"><span className="price">{money(pv.pricePaise)}</span><small>Price set by the maker</small></p>
            <p className="muted">{pv.seller} · {pv.city}</p>
          </>
        ) : (
          <>
            <span className="skeleton skeleton-line short" aria-hidden="true" />
            <span className="skeleton skeleton-line title" aria-hidden="true" />
            <span className="skeleton skeleton-line short" aria-hidden="true" />
          </>
        )}
        <div aria-hidden="true">
          <span className="skeleton skeleton-line" /><span className="skeleton skeleton-line" /><span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-button" />
        </div>
      </div>
    </article>
  );
}
