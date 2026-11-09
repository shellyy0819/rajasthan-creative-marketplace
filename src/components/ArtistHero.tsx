import Link from 'next/link';
import { productSlug } from '@/lib/catalog-shared';
import { money } from '@/lib/money';
import { instagramUrl, youtubeUrl } from '@/lib/social';
import type { Artist } from '@/lib/artists';
import type { Product } from '@/lib/types';
import { ArtistAvatar } from './ArtistAvatar';
import { ContactArtistButton } from './ContactArtistButton';
import { ProductImage } from './ProductImage';
import { StallAwning } from './StallAwning';
import { SYMBOLS, visualIndex } from './ProductCard';


const Pin = () => <svg className="ah-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="9.5" r="2.4" fill="currentColor" /></svg>;
const Tag = () => <svg className="ah-ico" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor" /></svg>;

/** The category most of the artist's pieces share (more than half), if any. */
export function sharedCategory(products: Product[]): string | undefined {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return top && n * 2 > products.length ? top : undefined;
}

export function ArtistHero({ a }: { a: Artist }) {
  const category = sharedCategory(a.products);
  const n = a.products.length;
  const first = a.products.slice(0, 3);
  return (
    <section className="artist-hero" aria-label={`About ${a.name}`}>
      <div className="ah-awning" aria-hidden="true"><StallAwning /></div>
      <div className="ah-center">
        <div className="ah-avatar" aria-hidden="true"><ArtistAvatar key={a.logoUrl ?? 'none'} src={a.logoUrl} initial={a.name.trim().charAt(0).toUpperCase()} /></div>
        <span className="eyebrow">MEET THE MAKER</span>
        <h1>{a.name}</h1>
        <div className="ah-chips">
          {a.city && <span className="ah-chip"><Pin />{a.city}</span>}
          {category && <span className="ah-chip">{category}</span>}
          <span className="ah-chip"><Tag />{n} {n === 1 ? 'piece' : 'pieces'}</span>
        </div>
        {a.bio && <p className="ah-bio">{a.bio}</p>}
        <div className="ah-acts">
          <ContactArtistButton product={a.products[0]} artistLevel />
          {a.instagram && <a className="button ah-ig" href={instagramUrl(a.instagram)} target="_blank" rel="noreferrer">Instagram ↗</a>}
        </div>
        {(a.phone || a.email || a.youtube) && (
          <ul className="ah-links">
            {a.phone && <li><a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`}>{a.phone}</a></li>}
            {a.email && <li><a href={`mailto:${a.email}`}>{a.email}</a></li>}
            {a.youtube && <li><a href={youtubeUrl(a.youtube)} target="_blank" rel="noreferrer">YouTube ↗</a></li>}
          </ul>
        )}
      </div>
      <div className="ah-row" data-count={first.length}>
        {first.map(p => (
          <Link key={p.id} className="ah-card" href={`/products/${productSlug(p)}`}>
            <span className="ah-photo"><ProductImage src={p.imageUrl} alt="" fallback={<span className={`ah-fallback visual-${visualIndex(p.id) % 4}`} aria-hidden="true">{SYMBOLS[visualIndex(p.id) % SYMBOLS.length]}</span>} /></span>
            <span className="ah-cname">{p.name}</span>
            <span className="ah-ptag"><span className="ah-hole" aria-hidden="true" />{money(p.pricePaise)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
