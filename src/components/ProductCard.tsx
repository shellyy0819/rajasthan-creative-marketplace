import Link from 'next/link';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';
import { productSlug } from '@/lib/catalog';
import { AddToCartButton } from './AddToCartButton';

export const SYMBOLS = ['🌷', '⛵', '🌼', '🏺', '🧶', '🌸'];
export const visualIndex = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export function ProductCard({ p }: { p: Product }) {
  const i = visualIndex(p.id);
  return (
    <article className="product-card">
      <div className={`product-visual visual-${i % 4}`} aria-hidden="true"><span className="symbol">{SYMBOLS[i % SYMBOLS.length]}</span></div>
      <div className="product-info">
        <span className="product-meta">{p.category} · {p.city}</span>
        <h3><Link href={`/products/${productSlug(p)}`}>{p.name}</Link></h3>
        <p>{p.description}<br />By {p.seller}</p>
        <div className="product-bottom">
          <span className="price">{money(p.pricePaise)}</span>
          <AddToCartButton product={p} />
        </div>
      </div>
    </article>
  );
}
