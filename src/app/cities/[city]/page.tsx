import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { WorkshopList } from '@/components/WorkshopList';
import { listProducts, listWorkshops } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ city: string }> };

/** Only active cities (an APPROVED product or workshop) have a page; any other slug is a 404. */
async function activeCity(slug: string) {
  return (await listActiveCities()).find(c => c.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await activeCity((await params).city);
  if (!c) return { title: 'City not found', robots: { index: false } };
  const city = c.name;
  return pageMetadata({
    title: `Products, Sellers & Workshops in ${city}`,
    description: `Find products from independent sellers in ${city} and contact them directly to order. Also discover creative workshops and meetups in ${city}, India.`,
    path: `/cities/${c.slug}`,
  });
}

export default async function CityPage({ params }: Props) {
  const c = await activeCity((await params).city);
  if (!c) notFound();
  const city = c.name;
  // Filter by slug: two cities can share a name (Udaipur, Rajasthan vs Udaipur, Tripura).
  const [products, workshops] = await Promise.all([listProducts({ city: c.slug }), listWorkshops({ city: c.slug })]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: city, path: `/cities/${c.slug}` }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">{[city, c.state, 'India'].filter(Boolean).join(', ').toUpperCase()}</span>
        <h1>Products &amp; workshops in {city}</h1>
      </div>
      <section className="section" aria-labelledby="c-shop">
        <div className="section-heading"><h2 id="c-shop">Products</h2>{products.length > 0 && <span className="muted">{products.length} {products.length === 1 ? 'find' : 'finds'}</span>}</div>
        <ProductGrid products={products} emptyMessage="No products here yet." />
      </section>
      <section className="workshop-band stacked" aria-labelledby="c-ws">
        <div className="section-heading"><h2 id="c-ws">Workshops</h2>{workshops.length > 0 && <span className="muted">{workshops.length} {workshops.length === 1 ? 'workshop' : 'workshops'}</span>}</div>
        <WorkshopList workshops={workshops} emptyMessage="No workshops here yet." />
      </section>
    </>
  );
}
