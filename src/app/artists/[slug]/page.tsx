import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArtistHero } from '@/components/ArtistHero';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { Share } from '@/components/Share';
import { ProductGrid } from '@/components/ProductGrid';
import { TrackOnMount } from '@/components/TrackOnMount';
import { TrackSellerProfileView } from '@/components/TrackSellerProfileView';
import { getArtist } from '@/lib/artists';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { isHandmade } from '@/lib/handmade';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> };


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const a = await getArtist(slug);
  if (!a) return { title: 'Artist not found', robots: { index: false } };
  const allHandmade = a.products.every(isHandmade);
  return pageMetadata({
    // "Handmade" is claimed only when every product on the page counts as handmade.
    title: allHandmade ? `${a.name} — handmade by an independent artist` : `${a.name} — an independent artist`,
    description: `${a.products[0].description} Shop ${a.products.length} ${allHandmade ? 'handmade ' : ''}${a.products.length === 1 ? 'piece' : 'pieces'} by ${a.name}.`,
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
  const share = await Share({ path: `/artists/${a.slug}`, title: a.name, kind: 'artist', subtitle: a.city ?? undefined, image: a.logoUrl ?? a.products[0]?.imageUrl });
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <TrackSellerProfileView sellerSlug={a.slug} />
      {from && <TrackOnMount productId={from} type="artist" />}
      <ArtistHero a={a} share={share} />
      {rest.length > 0 && (
        <section className="section">
          <div className="section-heading"><h2>More pieces</h2>{rest.length > 1 && <span className="muted">{rest.length} pieces</span>}</div>
          <ProductGrid products={rest} />
        </section>
      )}
    </>
  );
}
