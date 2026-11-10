export const SITE = {
  name: 'Craftofy',
  tagline: 'Handmade products from Indian artisans',
  description:
    'Discover handmade products from independent artisans across India and book creative workshops. Contact makers directly to order.',
  locale: 'en_IN',
};

/** Craftofy's own Instagram account. */
export const INSTAGRAM_HANDLE = 'craftofy_official';

const EMAIL = /^[^\s@,?]+@[^\s@,?]+\.[^\s@,?]+$/;
/** The address used for all communication until a domain address replaces it (set CONTACT_EMAIL to override). */
export const DEFAULT_CONTACT_EMAIL = 'hello.craftofy@gmail.com';
/** The public contact address: CONTACT_EMAIL when it is a usable email, otherwise the default. */
export function contactEmail(): string {
  const v = (process.env.CONTACT_EMAIL ?? '').trim();
  return EMAIL.test(v) ? v : DEFAULT_CONTACT_EMAIL;
}

/** Public site origin. A non-local http:// value is upgraded to https:// so sitemap, canonical and OG urls are always secure. */
export function siteUrl(): string {
  const url = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return /^http:\/\/(?!localhost(:|\/|$)|127\.0\.0\.1(:|\/|$))/i.test(url) ? url.replace(/^http:/i, 'https:') : url;
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
