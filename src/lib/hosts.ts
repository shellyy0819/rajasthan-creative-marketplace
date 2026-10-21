/**
 * Which hostname may show what. One deployment serves both sites:
 *   NEXT_PUBLIC_SITE_URL  the public shop,   e.g. https://www.example.com
 *   DASHBOARD_URL         the dashboard,     e.g. https://dashboard.example.com   (unset = single-host mode, e.g. local dev)
 * This only separates the two sites. It is NOT security: every API route and page still checks the user's role.
 */
export type HostConfig = { dashboardHost?: string; dashboardOrigin?: string; publicOrigin?: string };
export type Decision =
  | { action: 'next' }
  | { action: 'rewrite'; to: string }
  | { action: 'redirect'; to: string; status: 307 | 308 }
  | { action: 'notfound' };

/** Lower-cased host without a default port. Takes the first value of a comma-separated x-forwarded-host. */
export function normalizeHost(raw: string | null | undefined): string {
  const first = (raw ?? '').split(',')[0].trim().toLowerCase();
  return first.replace(/:(80|443)$/, '');
}

const parseOrigin = (v: string | undefined) => {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? { origin: u.origin.toLowerCase(), host: normalizeHost(u.host) } : undefined;
  } catch { return undefined; }
};

export function hostConfig(env: Record<string, string | undefined> = process.env): HostConfig {
  const dash = parseOrigin(env.DASHBOARD_URL);
  const site = parseOrigin(env.NEXT_PUBLIC_SITE_URL);
  if (!dash || !site || dash.host === site.host) return {}; // single-host mode (same host would redirect forever)
  return { dashboardHost: dash.host, dashboardOrigin: dash.origin, publicOrigin: site.origin };
}

const under = (path: string, base: string) => path === base || path.startsWith(base + '/');
// Always served, whatever the host: the API enforces its own rules, the rest is framework/static.
const ALWAYS = ['/api', '/_next', '/favicon.ico', '/icon', '/apple-icon', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml', '/opengraph-image'];
const isAlways = (path: string) => ALWAYS.some(p => under(path, p));

export function routeFor(host: string | null | undefined, pathname: string, cfg: HostConfig = hostConfig(), search = ''): Decision {
  const h = normalizeHost(host);
  const legacyTail = pathname.slice('/admin'.length); // "" or "/posts"…
  if (isAlways(pathname)) return { action: 'next' };

  if (!cfg.dashboardHost) { // single-host mode
    return under(pathname, '/admin') ? { action: 'redirect', to: `/dashboard${legacyTail}${search}`, status: 308 } : { action: 'next' };
  }
  if (h === cfg.dashboardHost) {
    if (pathname === '/') return { action: 'rewrite', to: '/dashboard' };
    if (under(pathname, '/dashboard')) return { action: 'next' };
    if (under(pathname, '/admin')) return { action: 'redirect', to: `${cfg.dashboardOrigin}/dashboard${legacyTail}${search}`, status: 308 };
    return { action: 'redirect', to: `${cfg.publicOrigin}${pathname}${search}`, status: 307 };
  }
  // the public host, or any other host (an IP address, a typo domain)
  if (under(pathname, '/dashboard')) return { action: 'notfound' };
  if (under(pathname, '/admin')) return { action: 'redirect', to: `${cfg.dashboardOrigin}/dashboard${legacyTail}${search}`, status: 308 };
  return { action: 'next' };
}

/** Where to send a signed-out visitor. With two hosts sign-in must start on the public host (it owns the OAuth cookies). */
export function signInUrl(returnPath: string, cfg: HostConfig = hostConfig()): string {
  if (cfg.publicOrigin && cfg.dashboardOrigin)
    return `${cfg.publicOrigin}/api/auth/signin?callbackUrl=${encodeURIComponent(cfg.dashboardOrigin + returnPath)}`;
  return `/api/auth/signin?callbackUrl=${encodeURIComponent(returnPath)}`;
}
