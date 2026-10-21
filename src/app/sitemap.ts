import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';
import { CITIES, citySlug, listProducts, listWorkshops, productSlug, workshopSlug } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, workshops] = await Promise.all([listProducts(), listWorkshops()]);
  return [
    { url: abs('/'), changeFrequency: 'weekly', priority: 1 },
    { url: abs('/shop'), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/workshops'), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/trending'), changeFrequency: 'daily', priority: 0.6 },
    ...CITIES.map(c => ({ url: abs(`/cities/${citySlug(c)}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map(p => ({ url: abs(`/products/${productSlug(p)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...[...new Set(products.map(p => p.sellerSlug).filter((x): x is string => !!x))].map(slug => ({ url: abs(`/artists/${slug}`), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...workshops.map(w => ({ url: abs(`/workshops/${workshopSlug(w)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
