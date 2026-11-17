import { siteUrl } from './site';

/** The address links in the mail should use: the configured site address, unless that is only the local default and the request came in on a real host. */
export function publicOrigin(h: { get(name: string): string | null }): string {
  const configured = siteUrl();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(configured) || !host || /^(localhost|127\.0\.0\.1)(:|$)/i.test(host) || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return configured;
  const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim() === 'http' ? 'http' : 'https';
  return `${proto}://${host}`;
}
