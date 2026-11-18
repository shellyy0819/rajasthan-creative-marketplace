import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CategoryPagination } from '@/components/CategoryPagination';
import { JsonLd } from '@/components/JsonLd';
import { ProductGrid } from '@/components/ProductGrid';
import { capitalize, getCatalogWording } from '@/lib/catalog-wording';
import { SHOP_PAGE_SIZE } from '@/lib/catalog-shared';
import { getCategoryEntry, listCategoryPage } from '@/lib/category-pages';
import { breadcrumbJsonLd, categoryJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import '../categories.css';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SP> };

/** The page number: absent means 1; only a plain positive whole number is accepted (anything else is null, which becomes a 404). */
function pageOf(sp: SP): number | null {
  const v = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  if (v === undefined) return 1;
  return /^[1-9]\d{0,5}$/.test(v) ? Number(v) : null;
}
/** Any parameter other than `page` (city, sort, source, search) makes this a filtered view, which search engines should not index. */
const filtered = (sp: SP) => Object.keys(sp).some(k => k !== 'page');

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const entry = await getCategoryEntry(slug);
  if (!entry) return { title: 'Category not found', robots: { index: false } };
  const page = pageOf(sp);
  // The page itself will be a 404 (a bad or too-high page number): never index it (the response can still be a 200 while it streams).
  if (page === null || page > Math.max(1, Math.ceil(entry.count / SHOP_PAGE_SIZE))) return { title: 'Page not found', robots: { index: false } };
  const w = await getCatalogWording();
  const base = `/categories/${slug}`;
  const noindex = filtered(sp);
  return pageMetadata({
    title: `${entry.name}: ${capitalize(w.products)} from Indian Artisans${page > 1 && !noindex ? ` (page ${page})` : ''}`,
    description: `Browse ${entry.count} ${w.products} in ${entry.name} from independent makers across India and contact the maker directly to order.`,
    path: page > 1 && !noindex ? `${base}?page=${page}` : base,
    noindex,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const entry = await getCategoryEntry(slug);
  const page = pageOf(sp);
  if (!entry || page === null) notFound();
  const [w, list] = await Promise.all([getCatalogWording(), listCategoryPage(entry, page)]);
  if (page > list.pages) notFound();
  const base = `/categories/${entry.slug}`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Categories', path: '/categories' }, { name: entry.name, path: base }];
  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(crumbs), categoryJsonLd(entry.name, base, list.products)]} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">CATEGORY</span>
        <h1><CategoryIcon name={entry.name} large />{entry.name}</h1>
        <p>Browse {entry.count} {w.products} in {entry.name} from independent makers across India. Contact the maker directly to order.</p>
      </div>
      <section className="section" aria-label={`${entry.name} products`}>
        <ProductGrid products={list.products} />
      </section>
      <CategoryPagination base={base} page={page} pages={list.pages} />
    </>
  );
}
