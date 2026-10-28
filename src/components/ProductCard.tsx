import Link from 'next/link';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';
import { productSlug } from '@/lib/catalog-shared';
import { ContactArtistButton } from './ContactArtistButton';
import { LikeButton } from './LikeButton';
import { ProductImage } from './ProductImage';

export const SYMBOLS = ['🌷', '⛵', '🌼', '🏺', '🧶', '🌸'];
export const visualIndex = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export function ProductCard({ p }: { p: Product }) {
  const i = visualIndex(p.id);
  return (
    <article className="product-card">
      <div className={`product-visual visual-${i % 4}`}><ProductImage src={p.imageUrl} alt={p.name} fallback={<span className="symbol" aria-hidden="true">{SYMBOLS[i % SYMBOLS.length]}</span>} /></div>
      <div className="product-info">
        <span className="product-meta">{p.category} · {p.city}</span>
        <h3><Link href={`/products/${productSlug(p)}`}>{p.name}</Link></h3>
        <p>{p.description}<br />By {p.seller}</p>
        <div className="product-bottom">
          <span className="price-like"><span className="price">{money(p.pricePaise)}</span><LikeButton productId={p.id} initialCount={p.likeCount ?? 0} productName={p.name} /></span>
          <ContactArtistButton product={p} />
        </div>
      </div>
    </article>
  );
}
