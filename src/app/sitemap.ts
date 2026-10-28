import type { MetadataRoute } from 'next';
import { abs } from '@/lib/site';
import { listProducts, listWorkshops, productSlug, workshopSlug } from '@/lib/catalog';
import { listActiveCities } from '@/lib/cities';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, workshops, cities] = await Promise.all([listProducts(), listWorkshops(), listActiveCities()]);
  return [
    { url: abs('/'), changeFrequency: 'weekly', priority: 1 },
    { url: abs('/shop'), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/workshops'), changeFrequency: 'daily', priority: 0.9 },
    { url: abs('/trending'), changeFrequency: 'daily', priority: 0.6 },
    ...['/about', '/blogs', '/contact', '/help'].map(path => ({ url: abs(path), changeFrequency: 'monthly' as const, priority: 0.4 })),
    ...cities.map(c => ({ url: abs(`/cities/${c.slug}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map(p => ({ url: abs(`/products/${productSlug(p)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...[...new Set(products.map(p => p.sellerSlug).filter((x): x is string => !!x))].map(slug => ({ url: abs(`/artists/${slug}`), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...workshops.map(w => ({ url: abs(`/workshops/${workshopSlug(w)}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
