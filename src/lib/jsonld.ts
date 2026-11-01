import { abs, siteUrl, SITE } from './site';
import { productSlug, workshopSlug } from './catalog';
import type { Product, Workshop } from './types';

const CTX = 'https://schema.org';
const price = (paise: number) => (paise / 100).toFixed(2);

export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const organizationJsonLd = () => ({
  '@context': CTX, '@type': 'Organization',
  name: SITE.name, url: siteUrl(), description: SITE.description,
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
    offers: {
      '@type': 'Offer', url: abs(path), priceCurrency: 'INR', price: price(p.pricePaise),
      availability: `https://schema.org/${p.stock > 0 ? 'InStock' : 'OutOfStock'}`,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: p.seller },
    },
  };
}

export function workshopJsonLd(w: Workshop) {
  const path = `/workshops/${workshopSlug(w)}`;
  const left = Math.max(0, w.seats - w.booked);
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
    maximumAttendeeCapacity: w.seats,
    remainingAttendeeCapacity: left,
    offers: {
      '@type': 'Offer', url: abs(path), priceCurrency: 'INR', price: price(w.pricePaise),
      availability: `https://schema.org/${left > 0 ? 'InStock' : 'SoldOut'}`,
    },
  };
}

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  '@context': CTX, '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});
