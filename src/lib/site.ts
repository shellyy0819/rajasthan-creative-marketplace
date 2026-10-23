export const SITE = {
  name: 'Craftology',
  tagline: 'Handmade finds & creative workshops across India',
  description:
    'Shop thoughtfully curated handmade products from independent artisans and book hands-on workshops in Udaipur, Jaipur and Jodhpur.',
  locale: 'en_IN',
  email: 'hello@craftology.example',
};
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
