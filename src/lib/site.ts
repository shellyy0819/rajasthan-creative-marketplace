export const SITE = {
  name: 'Rang Rajasthan',
  tagline: 'Handmade finds & creative workshops in Rajasthan',
  description:
    'Discover independent Rajasthan makers, thoughtful handmade finds, and creative workshops in Udaipur, Jaipur and Jodhpur.',
  locale: 'en_IN',
  email: 'hello@rangrajasthan.example',
};
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const abs = (p: string) => siteUrl() + (p.startsWith('/') ? p : `/${p}`);
