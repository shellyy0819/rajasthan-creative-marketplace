import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DataVersionProvider } from '@/components/DataVersion';
import { LiveCatalog } from '@/components/LiveCatalog';
import { JsonLd } from '@/components/JsonLd';
import { countProducts, listProducts } from '@/lib/catalog';
import { SHOP_PAGE_SIZE } from '@/lib/catalog-shared';
import { capitalize, getCatalogWording } from '@/lib/catalog-wording';
import { listCategories } from '@/lib/categories';
import { listSourcingTypes } from '@/lib/sourcing-types';
import { listActiveCities } from '@/lib/cities';
import { getDataVersion } from '@/lib/data-version';
import { hasFilters, parseFilters } from '@/lib/filters';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseFilters(await searchParams);
  // With no product at all the page is empty content (a "soft 404" to search engines): keep it out of the index until one exists.
  const none = !hasFilters(f) && (await countProducts({})) === 0;
  const w = await getCatalogWording();
  const { products, makers, cities } = w.stats;
  const base = `${capitalize(w.products)} from Indian Artisans`;
  return pageMetadata({
    title: f.category ? `${f.category}: ${base}` : base,
    description: products > 0
      ? `Discover ${products} ${w.products} from ${makers} independent ${makers === 1 ? 'maker' : 'makers'} in ${cities} ${cities === 1 ? 'city' : 'cities'}. Filter by category or city and contact the maker directly to order.`
      : `Discover ${w.products} from independent makers. Filter by category or city and contact the maker directly to order.`,
    path: '/shop',
    noindex: hasFilters(f) || none,
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const [wording, products, total, categories, cities, sourcingTypes, version] = await Promise.all([getCatalogWording(), listProducts({ ...f, limit: SHOP_PAGE_SIZE }), countProducts(f), listCategories(), listActiveCities(), listSourcingTypes(), getDataVersion()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }];
  return (
    <DataVersionProvider version={version}>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">THE MAKERS&apos; SHELF</span>
        <h1>{capitalize(wording.products)}</h1>
        <p>Craftofy is an online marketplace for {wording.products} from independent artisans across India. Browse by category or city, then contact the maker directly to order. Craftofy charges makers no commission.</p>
      </div>
      <LiveCatalog kind="products" initialItems={products} initialTotal={total} initialValues={f} categories={categories} sourcingTypes={sourcingTypes.map(t => t.name)} cities={cities.map(c => ({ name: c.name, slug: c.slug, state: c.state }))} />
    </DataVersionProvider>
  );
}
