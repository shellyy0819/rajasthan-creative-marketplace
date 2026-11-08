import { hostConfig } from './hosts';

/** Where sign-in may return to. Same-site relative paths, or an http(s) URL on one of the allowed hosts. Anything else is refused. */
export const DEFAULT_CALLBACK = '/sell';

/** Canonical lower-case host[:port] of a parsed URL (the URL parser already drops the scheme's own default port), or null for anything odd. */
function canonicalHost(u: URL): string | null {
  const host = u.host.toLowerCase();
  return /^[a-z0-9.-]+(:\d{1,5})?$/.test(host) ? host : null; // no commas, brackets, percent signs, userinfo
}

const hostOf = (origin: string | undefined): string | null => {
  if (!origin) return null;
  try { const u = new URL(origin); return u.protocol === 'https:' || u.protocol === 'http:' ? canonicalHost(u) : null; } catch { return null; }
};

/** The hosts a callback may point at: this site (the request's base URL and the configured site URLs) and the dashboard host. One list for the page and the auth redirect. */
export function allowedCallbackHosts(baseUrl?: string): string[] {
  const cfg = hostConfig();
  const list = [baseUrl, process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL, cfg.publicOrigin, cfg.dashboardOrigin].map(hostOf);
  return [...new Set(list.filter((h): h is string => !!h))];
}

/** A callback that points at the sign-in page or the auth API would loop forever for a signed-in user. */
function pointsAtAuth(raw: string): boolean {
  try {
    let path = new URL(raw, 'http://x.invalid').pathname;
    try { path = decodeURIComponent(path); } catch { /* keep as is */ }
    return /^\/(signin|api\/auth)(\/|$)/.test(path);
  } catch { return true; }
}

/** Returns the callback when it is safe, otherwise null. `hosts` come from allowedCallbackHosts(). http: is refused in production. */
export function safeCallback(raw: unknown, hosts: string[]): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > 2048) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null; // backslash and control-character tricks
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/')) return pointsAtAuth(raw) ? null : raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && process.env.NODE_ENV !== 'production')) return null;
    if (u.username || u.password) return null;
    const host = canonicalHost(u);
    if (!host || !hosts.includes(host)) return null;
    return pointsAtAuth(raw) ? null : raw;
  } catch { return null; }
}

/** In split-host mode the dashboard lives on its own origin: a relative /dashboard path must go there, not to the public host. */
export function onDashboardHost(callback: string, dashboardOrigin: string | undefined): string {
  return dashboardOrigin && /^\/dashboard(\/|\?|#|$)/.test(callback) ? dashboardOrigin + callback : callback;
}
