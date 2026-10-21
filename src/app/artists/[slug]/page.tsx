import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { TrackOnMount } from '@/components/TrackOnMount';
import { getArtist } from '@/lib/artists';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> };

const instagramUrl = (v: string) => `https://www.instagram.com/${encodeURIComponent(v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, ''))}/`;
const youtubeUrl = (v: string) => (/^https:\/\/(www\.)?youtube\.com\//i.test(v) || /^https:\/\/youtu\.be\//i.test(v) ? v : `https://www.youtube.com/@${encodeURIComponent(v.replace(/^@/, ''))}`);

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
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }, { name: a.name, path: `/artists/${a.slug}` }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      {from && <TrackOnMount productId={from} type="artist" />}
      <div className="page-head">
        <span className="eyebrow">ARTIST</span>
        <h1>{a.name}</h1>
        <ul className="artist-contact">
          {a.phone && <li><a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`}>{a.phone}</a></li>}
          {a.email && <li><a href={`mailto:${a.email}`}>{a.email}</a></li>}
          {a.instagram && <li><a href={instagramUrl(a.instagram)} target="_blank" rel="noreferrer">Instagram ↗</a></li>}
          {a.youtube && <li><a href={youtubeUrl(a.youtube)} target="_blank" rel="noreferrer">YouTube ↗</a></li>}
        </ul>
      </div>
      <section className="section"><ProductGrid products={a.products} /></section>
    </>
  );
}
