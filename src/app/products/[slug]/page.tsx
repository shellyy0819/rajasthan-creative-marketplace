import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AddToCartButton } from '@/components/AddToCartButton';
import { SYMBOLS, visualIndex } from '@/components/ProductCard';
import { citySlug, getProductBySlug, listProducts, productSlug } from '@/lib/catalog';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import { money } from '@/lib/money';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await listProducts()).map(p => ({ slug: productSlug(p) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  return pageMetadata({
    title: `${p.name} — handmade in ${p.city}`,
    description: `${p.description} Handmade by ${p.seller} in ${p.city}. ${money(p.pricePaise)}.`,
    path: `/products/${productSlug(p)}`,
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
        <div className={`product-visual detail-art visual-${i % 4}`} aria-hidden="true"><span className="symbol">{SYMBOLS[i % SYMBOLS.length]}</span></div>
        <div>
          <span className="product-meta">{p.category}</span>
          <h1>{p.name}</h1>
          <p className="lead">{p.description}</p>
          <dl>
            <dt>Maker</dt><dd>{p.seller}</dd>
            <dt>City</dt><dd><Link href={`/cities/${citySlug(p.city)}`}>{p.city}</Link></dd>
            <dt>Availability</dt><dd>{p.stock > 0 ? `${p.stock} in stock` : 'Sold out'}</dd>
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
