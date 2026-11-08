/** Where sign-in may return to. Same-site relative paths, or an http(s) URL on one of the allowed hosts. Anything else is refused. */
export const DEFAULT_CALLBACK = '/sell';

/** Returns the callback when it is safe, otherwise null. Pure: no env reads. `hosts` are normalised host names (no default port). */
export function safeCallback(raw: unknown, hosts: (string | undefined)[], normalize: (h: string) => string): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > 2048) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null; // backslash and control-character tricks
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    const host = normalize(u.host);
    return hosts.some(h => h && h === host) ? raw : null;
  } catch { return null; }
}
