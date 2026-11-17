/** The registrable domain Craftofy runs on. Fixed here, not read from the environment. */
export const SITE_DOMAIN = 'craftofy.online';

type Headers = { get(name: string): string | null };

const hostOf = (v: string | null): string | null => {
  const raw = (v ?? '').split(',')[0].trim().toLowerCase();
  const host = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^[a-z0-9.-]+(:\d+)?$/.test(host) ? host : null;
};

/** Craftofy's own hosts (craftofy.online and its subdomains) and, for development, localhost. Anything else is refused. */
const allowed = (host: string) => {
  const name = host.replace(/:\d+$/, '');
  return name === SITE_DOMAIN || name.endsWith(`.${SITE_DOMAIN}`) || name === 'localhost' || name === '127.0.0.1';
};

/**
 * The address links in a Craftofy email should use: the host the buyer was on, taken from the request (the browser's Origin first, then Referer,
 * then Host), so the link matches the site they used instead of an environment value. Only Craftofy's own domain (and localhost in development)
 * is accepted: a request that names any other host is ignored, so a forged header cannot point a Craftofy email at someone else's site.
 * Null when no acceptable host is found; the caller then falls back to the configured address.
 */
export function requestOrigin(h: Headers): string | null {
  for (const v of [h.get('origin'), h.get('referer'), h.get('x-forwarded-host'), h.get('host')]) {
    const host = hostOf(v);
    if (host && allowed(host)) return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https'}://${host}`;
  }
  return null;
}
