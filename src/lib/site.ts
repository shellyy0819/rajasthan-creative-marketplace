export const SITE = {
  name: 'Craftofy',
  tagline: 'Handmade finds & creative workshops across India',
  description:
    'Shop thoughtfully curated handmade products from independent artisans and book hands-on workshops in cities across India.',
  locale: 'en_IN',
};

const EMAIL = /^[^\s@,?]+@[^\s@,?]+\.[^\s@,?]+$/;
/** The public contact address, set per deployment with CONTACT_EMAIL. Undefined when unset or invalid: callers then show no email link or text. */
export function contactEmail(): string | undefined {
  const v = (process.env.CONTACT_EMAIL ?? '').trim();
  return EMAIL.test(v) ? v : undefined;
}
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
