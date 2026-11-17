/** The exact hostnames Craftofy is served on. Fixed here, not read from the environment; no wildcard subdomains and no ports. Add a host here when a new one goes live. */
export const SITE_HOSTS: readonly string[] = ['craftofy.online', 'www.craftofy.online', 'api.craftofy.online'];

type Headers = { get(name: string): string | null };

const hostOf = (v: string | null): string | null => {
  const raw = (v ?? '').split(',')[0].trim().toLowerCase();
  const host = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^[a-z0-9.-]+(:\d+)?$/.test(host) ? host : null;
};

/** One of Craftofy's exact hosts (any port, a wildcard or a look-alike is refused), or localhost, which only counts outside production. */
const allowed = (host: string) => {
  if (SITE_HOSTS.includes(host)) return true;
  return process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
};

/**
 * The address links in a Craftofy email should use: the host the buyer was on, taken from the request (the browser's Origin first, then Referer,
 * then Host), so the link matches the site they used instead of an environment value. Only Craftofy's exact hosts (and localhost outside
 * production) are accepted: a request that names any other host is ignored, so a forged header cannot point a Craftofy email at someone else's site.
 * Null when no acceptable host is found; the caller then falls back to the configured address.
 */
export function requestOrigin(h: Headers): string | null {
  for (const v of [h.get('origin'), h.get('referer'), h.get('x-forwarded-host'), h.get('host')]) {
    const host = hostOf(v);
    if (host && allowed(host)) return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'}://${host}`;
  }
  return null;
}
