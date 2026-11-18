import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CategoryIcon } from '@/components/CategoryIcon';
import { JsonLd } from '@/components/JsonLd';
import { capitalize, getCatalogWording } from '@/lib/catalog-wording';
import { listCategoryIndex } from '@/lib/category-pages';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { pageMetadata } from '@/lib/meta';
import './categories.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const w = await getCatalogWording();
  return pageMetadata({
    title: `Shop by Category: ${capitalize(w.products)} from Indian Artisans`,
    description: `Browse ${w.products} by category from independent makers across India, and contact the maker directly to order.`,
    path: '/categories',
  });
}

export default async function CategoriesPage() {
  const [w, list] = await Promise.all([getCatalogWording(), listCategoryIndex()]);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Categories', path: '/categories' }];
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <div className="page-head">
        <span className="eyebrow">SHOP BY CATEGORY</span>
        <h1>Categories</h1>
        <p>Browse {w.products} from independent makers across India by category.</p>
      </div>
      {list.length === 0 ? (
        <p className="page-head">No categories yet. Check back soon.</p>
      ) : (
        <ul className="cat-list">
          {list.map(c => (
            <li key={c.slug}>
              <Link href={`/categories/${c.slug}`}>
                <span className="cat-card-name"><CategoryIcon name={c.name} /><span>{c.name}</span></span>
                <small>{c.count}</small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
