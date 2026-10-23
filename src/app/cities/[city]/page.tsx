import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { WorkshopList } from '@/components/WorkshopList';
import { CITIES, citySlug, cityFromSlug, listProducts, listWorkshops } from '@/lib/catalog';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

export const dynamic = 'force-dynamic';
export const dynamicParams = false;
type Props = { params: Promise<{ city: string }> };

export const generateStaticParams = () => CITIES.map(c => ({ city: citySlug(c) }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = cityFromSlug((await params).city);
  if (!city) return { title: 'City not found', robots: { index: false } };
  return pageMetadata({
    title: `Handmade finds & creative workshops in ${city}`,
    description: `Shop handmade crafts by ${city} makers and book creative workshops and meetups in ${city}, India.`,
    path: `/cities/${citySlug(city)}`,
  });
}

export default async function CityPage({ params }: Props) {
  const city = cityFromSlug((await params).city);
  if (!city) notFound();
  const [products, workshops] = await Promise.all([listProducts({ city }), listWorkshops({ city })]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: city, path: `/cities/${citySlug(city)}` }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">{city.toUpperCase()}, INDIA</span>
        <h1>Handmade finds &amp; workshops in {city}</h1>
        <p>Independent makers and creative gatherings in {city}.</p>
      </div>
      <section className="section" aria-labelledby="c-shop"><h2 id="c-shop">Handmade in {city}</h2><div style={{ height: 20 }} /><ProductGrid products={products} /></section>
      <section className="workshop-band" style={{ display: 'block' }} aria-labelledby="c-ws"><h2 id="c-ws" style={{ marginTop: 0 }}>Workshops in {city}</h2><WorkshopList workshops={workshops} /></section>
    </>
  );
}
