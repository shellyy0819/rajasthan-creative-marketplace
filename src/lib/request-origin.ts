import { headers } from 'next/headers';
import { hostConfig, normalizeHost } from '@/lib/hosts';
import { siteUrl } from '@/lib/site';

const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/;
const LOCAL = /^(localhost|127\.0\.0\.1)(:|$)/;

/**
 * Public origin for crawler files (sitemap, robots): the host the request came in on, so it is right even when
 * NEXT_PUBLIC_SITE_URL is misconfigured. Falls back to siteUrl() when the host is missing, malformed or the dashboard host.
 */
export function originFromRequest(
  host: string | null | undefined,
  proto: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  const h = normalizeHost(host);
  if (!h || !HOST.test(h) || h === hostConfig(env).dashboardHost) return siteUrl();
  const p = LOCAL.test(h) ? (proto ?? '').split(',')[0].trim().toLowerCase() === 'https' ? 'https' : 'http' : 'https';
  return `${p}://${h}`;
}

export async function requestOrigin(): Promise<string> {
  const h = await headers();
  return originFromRequest(h.get('x-forwarded-host') ?? h.get('host'), h.get('x-forwarded-proto'));
}
