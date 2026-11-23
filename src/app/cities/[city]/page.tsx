import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { WorkshopList } from '@/components/WorkshopList';
import { listProducts, listWorkshops } from '@/lib/catalog';
import { getCityWithListings } from '@/lib/cities';
import { isHandmade } from '@/lib/handmade';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ city: string }> };

/** A city has a page while it has any APPROVED product or workshop (ended ones too, so the link from an ended workshop still works); any other slug is a 404. */
const findCity = (slug: string) => getCityWithListings(slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await findCity((await params).city);
  if (!found) return { title: 'City not found', robots: { index: false } };
  const { city: c, active } = found;
  const city = c.name;
  return pageMetadata({
    title: `Products, Sellers & Workshops in ${city}`,
    description: `Find products from independent sellers in ${city} and contact them directly to order. Also discover creative workshops and meetups in ${city}, India.`,
    path: `/cities/${c.slug}`,
    noindex: !active, // only past workshops left here: the page works for people who follow a link, but is not offered to search engines
  });
}

export default async function CityPage({ params }: Props) {
  const found = await findCity((await params).city);
  if (!found) notFound();
  const c = found.city;
  const city = c.name;
  // Filter by slug: two cities can share a name (Udaipur, Rajasthan vs Udaipur, Tripura).
  const [products, workshops] = await Promise.all([listProducts({ city: c.slug }), listWorkshops({ city: c.slug, includeEnded: true })]);
  // "Handmade" is claimed only when every product shown counts as handmade (same rule as the artist page).
  const allHandmade = products.length > 0 && products.every(isHandmade);
  const crumbs = [{ name: 'Home', path: '/' }, { name: city, path: `/cities/${c.slug}` }];
  // A city with only workshops (or only products) shows just that section and says so in its heading.
  const noun = products.length === 0 && workshops.length > 0 ? 'Workshops' : workshops.length === 0 && products.length > 0 ? (allHandmade ? 'Handmade products' : 'Products') : `${allHandmade ? 'Handmade products' : 'Products'} & workshops`;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">{[city, c.state, 'India'].filter(Boolean).join(', ').toUpperCase()}</span>
        <h1>{noun} in {city}</h1>
      </div>
      {(products.length > 0 || workshops.length === 0) && (
        <section className="section" aria-labelledby="c-shop">
          <div className="section-heading"><h2 id="c-shop">{allHandmade ? 'Handmade' : 'Products'}</h2>{products.length > 0 && <span className="muted">{products.length} {products.length === 1 ? 'find' : 'finds'}</span>}</div>
          <ProductGrid products={products} emptyMessage="No products here yet." />
        </section>
      )}
      {workshops.length > 0 && (
        <section className="workshop-band stacked" aria-labelledby="c-ws">
          <div className="section-heading"><h2 id="c-ws">Workshops</h2><span className="muted">{workshops.length} {workshops.length === 1 ? 'workshop' : 'workshops'}</span></div>
          <WorkshopList workshops={workshops} emptyMessage="No workshops here yet." />
        </section>
      )}
    </>
  );
}
