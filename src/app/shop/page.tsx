import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { listProducts } from '@/lib/catalog';
import { listCategories } from '@/lib/categories';
import { listActiveCities } from '@/lib/cities';
import { hasFilters, parseFilters } from '@/lib/filters';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  return pageMetadata({
    title: 'Shop handmade crafts from India',
    description: 'Crochet, resin art, pottery and accessories from independent makers across India. Search by city and category.',
    path: '/shop',
    noindex: hasFilters(f),
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const [products, categories, cities] = await Promise.all([listProducts(f), listCategories(), listActiveCities()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">THE MAKERS&apos; SHELF</span>
        <h1>Handmade finds from India</h1>
        <p>Crochet, resin art, pottery and accessories from independent makers across India.</p>
      </div>
      <LiveCatalog kind="products" initialItems={products} initialValues={f} categories={categories} cities={cities.map(c => ({ name: c.name, slug: c.slug }))} />
    </>
  );
}
