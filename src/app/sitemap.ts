import type { MetadataRoute } from 'next';
import { requestOrigin } from '@/lib/request-origin';
import { listProducts, listWorkshops, productSlug, workshopSlug } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';
import { listCategoryIndex, listCategoryLastModified } from '@/lib/category-pages';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await requestOrigin();
  const abs = (p: string) => origin + p;
  const [products, workshops, cities, cats, catChanged] = await Promise.all([listProducts(), listWorkshops(), listActiveCities(), listCategoryIndex(), listCategoryLastModified()]);
  return [
    { url: abs('/'), changeFrequency: 'weekly', priority: 1 },
    // An empty list page is a soft 404 to search engines: list /shop and /workshops only while they have something.
    ...(products.length ? [{ url: abs('/shop'), changeFrequency: 'daily' as const, priority: 0.9 }] : []),
    ...(workshops.length ? [{ url: abs('/workshops'), changeFrequency: 'daily' as const, priority: 0.9 }] : []),
    ...(cats.length ? [{ url: abs('/categories'), changeFrequency: 'weekly' as const, priority: 0.8 }] : []),
    ...cats.map(c => ({ url: abs(`/categories/${c.slug}`), changeFrequency: 'weekly' as const, priority: 0.7, ...(catChanged[c.slug] ? { lastModified: catChanged[c.slug] } : {}) })),
    { url: abs('/trending'), changeFrequency: 'daily', priority: 0.6 },
    ...['/about', '/blogs', '/contact', '/help'].map(path => ({ url: abs(path), changeFrequency: 'monthly' as const, priority: 0.4 })),
    ...cities.map(c => ({ url: abs(`/cities/${c.slug}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map(p => ({ url: abs(`/products/${productSlug(p)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
    // One profile per person: makers with products and hosts with a published class or workshop.
    ...[...new Set([...products.map(p => p.sellerSlug), ...workshops.map(w => w.hostSlug)].filter((x): x is string => !!x))].map(slug => ({ url: abs(`/artists/${slug}`), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...workshops.map(w => ({ url: abs(`/workshops/${workshopSlug(w)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
