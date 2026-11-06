export const SITE = {
  name: 'Craftofy',
  tagline: 'Handmade finds & creative workshops across India',
  description:
    'Shop thoughtfully curated handmade products from independent artisans and book hands-on workshops in cities across India.',
  locale: 'en_IN',
};

const EMAIL = /^[^\s@,?]+@[^\s@,?]+\.[^\s@,?]+$/;
/** The address used for all communication until a domain address replaces it (set CONTACT_EMAIL to override). */
export const DEFAULT_CONTACT_EMAIL = 'craftofy.online@gmail.com';
/** The public contact address: CONTACT_EMAIL when it is a usable email, otherwise the default. */
export function contactEmail(): string {
  const v = (process.env.CONTACT_EMAIL ?? '').trim();
  return EMAIL.test(v) ? v : DEFAULT_CONTACT_EMAIL;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
