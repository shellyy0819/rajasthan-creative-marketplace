import { CODE_ALPHABET, CODE_RE } from '@/lib/fair-constants';
import { formatCode, normalizeCode, randomCode } from '@/lib/fair-characters';

/**
 * Who a code belongs to. Each browser keeps one secret; the first browser to use a code owns it, and the server only accepts that code from the same secret.
 * Nothing here identifies a person: the secret is random and the server stores only a hash of it.
 */
export const TOKEN_KEY = 'cf-fair-token';
export const TOKEN_RE = /^[a-f0-9]{32,64}$/;

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const newToken = (bytes: (n: number) => Uint8Array = randomBytes) => [...bytes(16)].map(b => b.toString(16).padStart(2, '0')).join('');

/** This browser's secret: read from storage, or made and saved. With storage blocked it lasts only for this page visit. */
export function getToken(storage: Pick<Storage, 'getItem' | 'setItem'> | null, make: () => string = newToken): string {
  try { const t = storage?.getItem(TOKEN_KEY); if (t && TOKEN_RE.test(t)) return t; } catch { /* blocked storage */ }
  const t = make();
  try { storage?.setItem(TOKEN_KEY, t); } catch { /* blocked storage */ }
  return t;
}

/** ok: it is yours now. taken: someone else owns it. offline: the server could not say (network, limits), so play on and try again later. */
export type ClaimResult = 'ok' | 'taken' | 'offline';
export async function claim(code: string, token: string, doFetch: typeof fetch = (...a) => fetch(...a)): Promise<ClaimResult> {
  try {
    const r = await doFetch('/api/fair/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, token }) });
    return r.status === 409 ? 'taken' : r.ok ? 'ok' : 'offline';
  } catch { return 'offline'; }
}
/** Picks random codes until one is free (almost always the first). */
export async function claimRandom(token: string, tries = 6, doFetch?: typeof fetch, make: () => string = () => randomCode(CODE_ALPHABET)): Promise<string> {
  let c = make();
  for (let i = 0; i < tries; i++) { c = make(); if (await claim(c, token, doFetch) !== 'taken') return c; }
  return c;
}

/** The code in the address bar (?code=ABC-234 or ?code=abc234), if it is a valid one. */
export function codeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('code');
  if (!raw) return null;
  const c = normalizeCode(raw);
  return CODE_RE.test(c) ? c : null;
}
/** The same address with this code in the query string; other parameters and the hash stay. */
export function withCode(href: string, code: string): string {
  const u = new URL(href, 'http://x');
  u.searchParams.set('code', formatCode(code));
  return href.startsWith('http') ? u.toString() : u.pathname + u.search + u.hash;
}
