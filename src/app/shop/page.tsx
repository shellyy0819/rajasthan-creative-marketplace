import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { SectionLoader } from '@/components/SectionLoader';
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
    title: 'Handmade Products from Indian Artisans',
    description: 'Discover handmade products from independent makers. Filter by category or city and contact the maker directly to order.',
    path: '/shop',
    noindex: hasFilters(f),
  });
}

/** The data-dependent part: filter bar and product grid. Streams in under the page heading. */
async function ShopCatalog({ filters: f }: { filters: ReturnType<typeof parseFilters> }) {
  const [products, categories, cities] = await Promise.all([listProducts(f), listCategories(), listActiveCities()]);
  return <LiveCatalog kind="products" initialItems={products} initialValues={f} categories={categories} cities={cities.map(c => ({ name: c.name, slug: c.slug, state: c.state }))} />;
}

export default async function ShopPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">THE MAKERS&apos; SHELF</span>
        <h1>Handmade products</h1>
        <p>Handmade finds from independent makers, made with care and sold directly by the people who craft them.</p>
      </div>
      <Suspense fallback={<SectionLoader label="Loading handmade finds…" variant="cards" />}>
        <ShopCatalog filters={f} />
      </Suspense>
    </>
  );
}
