import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { hostConfig, normalizeHost } from '@/lib/hosts';
import { requestOrigin } from '@/lib/request-origin';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = normalizeHost(h.get('x-forwarded-host') ?? h.get('host'));
  // The dashboard host is never for search engines.
  if (hostConfig().dashboardHost && host === hostConfig().dashboardHost) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/admin/'] }],
    sitemap: `${await requestOrigin()}/sitemap.xml`,
  };
}
