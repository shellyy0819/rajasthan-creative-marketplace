import { abs, contactEmail, siteUrl, INSTAGRAM_HANDLE, SITE } from './site';
import { productSlug, workshopSlug } from './catalog';
import type { Product, Workshop } from './types';

const CTX = 'https://schema.org';

export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const organizationJsonLd = () => ({
  '@context': CTX, '@type': 'Organization',
  name: SITE.name, url: siteUrl(), description: SITE.description, email: contactEmail(),
  logo: abs('/icons/icon-512.png'),
  sameAs: [`https://www.instagram.com/${INSTAGRAM_HANDLE}`],
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: contactEmail(), areaServed: 'IN', availableLanguage: ['en'] },
  areaServed: { '@type': 'AdministrativeArea', name: 'India' },
});

export const websiteJsonLd = () => ({
  '@context': CTX, '@type': 'WebSite',
  name: SITE.name, url: siteUrl(), inLanguage: 'en-IN',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${abs('/shop')}?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
});

export function productJsonLd(p: Product) {
  const path = `/products/${productSlug(p)}`;
  return {
    '@context': CTX, '@type': 'Product',
    name: p.name, description: p.description, sku: p.id, category: p.category,
    image: [...(p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : []), abs(`${path}/opengraph-image`)],
    brand: { '@type': 'Brand', name: p.seller },
  };
}

export function workshopJsonLd(w: Workshop) {
  const path = `/workshops/${workshopSlug(w)}`;
  return {
    '@context': CTX, '@type': 'Event',
    name: w.title, description: w.description, url: abs(path),
    image: [abs(`${path}/opengraph-image`)],
    startDate: `${w.date}T${w.time}:00+05:30`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place', name: w.venue,
      address: { '@type': 'PostalAddress', addressLocality: w.city, ...(w.cityState ? { addressRegion: w.cityState } : {}), addressCountry: 'IN' },
    },
    organizer: { '@type': 'Organization', name: w.host },
  };
}

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  '@context': CTX, '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});

/** The exhibition page (/fair): a walk-around of handmade stalls. */
export const fairJsonLd = (description: string) => ({
  '@context': CTX, '@type': 'WebPage',
  name: 'Craftofy Fair', description, url: abs('/fair'), inLanguage: 'en-IN',
  isPartOf: { '@type': 'WebSite', name: SITE.name, url: siteUrl() },
  about: 'Handmade products and creative workshops from independent makers in India',
});
