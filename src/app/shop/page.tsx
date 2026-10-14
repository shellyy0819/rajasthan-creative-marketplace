import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { FilterForm } from '@/components/FilterForm';
import { ProductGrid } from '@/components/ProductGrid';
import { JsonLd } from '@/components/JsonLd';
import { listProducts } from '@/lib/catalog';
import { hasFilters, parseFilters } from '@/lib/filters';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  return pageMetadata({
    title: 'Shop handmade crafts from Rajasthan',
    description: 'Crochet, resin art, pottery and accessories from independent makers in Udaipur, Jaipur and Jodhpur. Search by city and category.',
    path: '/shop',
    noindex: hasFilters(f),
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const products = await listProducts(f);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">THE MAKERS&apos; SHELF</span>
        <h1>Handmade finds from Rajasthan</h1>
        <p>{products.length} {products.length === 1 ? 'find' : 'finds'} to love{f.city ? ` in ${f.city}` : ''}.</p>
      </div>
      <section className="section" style={{ paddingTop: 10 }}>
        <FilterForm action="/shop" kind="products" values={f} />
        <ProductGrid products={products} />
      </section>
    </>
  );
}
