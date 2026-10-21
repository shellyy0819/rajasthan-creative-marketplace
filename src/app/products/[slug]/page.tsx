import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AddToCartButton } from '@/components/AddToCartButton';
import { LikeButton } from '@/components/LikeButton';
import { TrackOnMount } from '@/components/TrackOnMount';
import { TrackedLink } from '@/components/TrackedLink';
import { ProductImage } from '@/components/ProductImage';
import { SYMBOLS, visualIndex } from '@/components/ProductCard';
import { citySlug, getProductBySlug, productSlug } from '@/lib/catalog';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };

function instagramUrl(value: string) {
  const handle = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '');
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

function youtubeUrl(value: string) {
  if (/^https:\/\/(www\.)?youtube\.com\//i.test(value) || /^https:\/\/youtu\.be\//i.test(value)) return value;
  return `https://www.youtube.com/@${encodeURIComponent(value.replace(/^@/, ''))}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  return pageMetadata({
    title: `${p.name} — handmade in ${p.city}`,
    description: `${p.description} Handmade by ${p.seller} in ${p.city}. ${money(p.pricePaise)}.`,
    path: `/products/${productSlug(p)}`,
    image: false,
  });
}

export default async function ProductPage({ params }: Props) {
  const p = await getProductBySlug((await params).slug);
  if (!p) notFound();
  const i = visualIndex(p.id);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: p.name, path: `/products/${productSlug(p)}` }];
  return (
    <>
      <JsonLd data={[productJsonLd(p), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <article className="detail">
        <div className={`product-visual detail-art visual-${i % 4}`}><ProductImage src={p.imageUrl} alt={p.name} fallback={<span className="symbol" aria-hidden="true">{SYMBOLS[i % SYMBOLS.length]}</span>} /></div>
        <div>
          <span className="product-meta">{p.category}</span>
          <h1>{p.name}</h1>
          <LikeButton productId={p.id} initialCount={p.likeCount ?? 0} productName={p.name} />
          <TrackOnMount productId={p.id} type="view" />
          <p className="lead">{p.description}</p>
          <dl>
            <dt><span className="detail-label"><svg className="detail-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Artist</span></dt><dd>{p.sellerSlug ? <Link href={`/artists/${p.sellerSlug}?from=${p.id}`}>{p.seller}</Link> : p.seller}</dd>
            <dt><span className="detail-label"><svg className="detail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>City</span></dt><dd><Link href={`/cities/${citySlug(p.city)}`}>{p.city}</Link></dd>
            <dt><span className="detail-label"><svg className="detail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v10"/></svg>Availability</span></dt><dd>{p.stock > 0 ? `${p.stock} in stock` : 'Sold out'}</dd>
            {p.instagram && <><dt><span className="detail-label"><svg className="social-icon instagram-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="6" r="1.2" fill="currentColor"/></svg>Instagram</span></dt><dd><TrackedLink productId={p.id} type="contact" href={instagramUrl(p.instagram)} target="_blank" rel="noreferrer">{p.instagram.startsWith('@') ? p.instagram : `@${p.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')}`} ↗</TrackedLink></dd></>}
            {p.youtube && <><dt><span className="detail-label"><svg className="social-icon youtube-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"/><path d="m9.6 15.7 6.2-3.7-6.2-3.7v7.4Z" fill="white"/></svg>YouTube</span></dt><dd><TrackedLink productId={p.id} type="contact" href={youtubeUrl(p.youtube)} target="_blank" rel="noreferrer">Visit channel ↗</TrackedLink></dd></>}
            {p.phone && <><dt><span className="detail-label"><svg className="detail-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18H7z"/><path d="M10 18h4"/></svg>Phone</span></dt><dd><TrackedLink productId={p.id} type="contact" href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}>{p.phone}</TrackedLink></dd></>}
            {p.email && <><dt><span className="detail-label"><svg className="detail-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Email</span></dt><dd><TrackedLink productId={p.id} type="contact" href={`mailto:${p.email}`}>{p.email}</TrackedLink></dd></>}
          </dl>
          <div className="product-bottom" style={{ gap: 20, justifyContent: 'flex-start' }}>
            <span className="price">{money(p.pricePaise)}</span>
            <AddToCartButton product={p} />
          </div>
          <p className="fine-print" style={{ textAlign: 'left' }}>Demo checkout only. No payment is collected.</p>
        </div>
      </article>
    </>
  );
}
