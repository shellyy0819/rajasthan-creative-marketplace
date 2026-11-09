import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArtistHero } from '@/components/ArtistHero';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { TrackOnMount } from '@/components/TrackOnMount';
import { getArtist } from '@/lib/artists';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> };


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const a = await getArtist(slug);
  if (!a) return { title: 'Artist not found', robots: { index: false } };
  return pageMetadata({
    title: `${a.name} — handmade by an independent artist`,
    description: `${a.products[0].description} Shop ${a.products.length} handmade ${a.products.length === 1 ? 'piece' : 'pieces'} by ${a.name}.`,
    path: `/artists/${a.slug}`,
    image: false,
  });
}

export default async function ArtistPage({ params, searchParams }: Props) {
  const a = await getArtist((await params).slug);
  if (!a) notFound();
  const { from: fromParam } = await searchParams;
  const from = a.products.find(p => p.id === fromParam)?.id; // credit a visit only when the product really is this artist's
  const rest = a.products.slice(3); // the hero already shows the first three
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: a.name, path: `/artists/${a.slug}` }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      {from && <TrackOnMount productId={from} type="artist" />}
      <ArtistHero a={a} />
      {rest.length > 0 && (
        <section className="section">
          <div className="section-heading"><h2>More pieces</h2><span className="muted">{rest.length} {rest.length === 1 ? 'piece' : 'pieces'}</span></div>
          <ProductGrid products={rest} />
        </section>
      )}
    </>
  );
}
