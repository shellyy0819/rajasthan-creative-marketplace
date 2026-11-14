import Link from 'next/link';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';
import { productSlug } from '@/lib/catalog-shared';
import { ArtistAvatar } from './ArtistAvatar';
import { ContactArtistButton } from './ContactArtistButton';
import { LikeButton } from './LikeButton';
import { ProductImage } from './ProductImage';
import { ProductPlaceholder } from './ProductPlaceholder';

export const visualIndex = (id: string) => Number(id.replace(/\D/g, '')) || 0;

export function ProductCard({ p, eager = false }: { p: Product; eager?: boolean }) {
  const i = visualIndex(p.id);
  const low = p.stock > 0 && p.stock <= 2;
  return (
    <article className="product-card">
      <div className={`product-visual visual-${i % 4}`}><ProductImage src={p.imageUrl} alt={p.name} fallback={<ProductPlaceholder />} eager={eager} /></div>
      <div className="pc-top">
        <span className="pc-chips">
          <span className="pc-chip">{p.category}</span>
          {low && <span className="pc-low">Only {p.stock} left</span>}
        </span>
        <LikeButton productId={p.id} initialCount={p.likeCount ?? 0} productName={p.name} />
      </div>
      <div className="product-info">
        <h3><Link href={`/products/${productSlug(p)}`}>{p.name}</Link></h3>
        <p className="pc-who"><span className="pc-av" aria-hidden="true"><ArtistAvatar key={p.sellerLogo ?? 'none'} src={p.sellerLogo} initial={p.seller.trim().charAt(0).toUpperCase()} /></span><span>{p.seller} · {p.city}</span></p>
        <div className="product-bottom">
          <span className="price">{money(p.pricePaise)}</span>
          <ContactArtistButton product={p} iconOnly />
        </div>
      </div>
    </article>
  );
}
