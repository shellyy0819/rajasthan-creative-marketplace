export const SITE = {
  name: 'Craftofy',
  tagline: 'Handmade finds & creative workshops across India',
  description:
    'Shop thoughtfully curated handmade products from independent artisans and book hands-on workshops in cities across India.',
  locale: 'en_IN',
  email: 'hello.craftofy@gmail.com',
};
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
