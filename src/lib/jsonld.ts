import { abs, contactEmail, siteUrl, INSTAGRAM_HANDLE, SITE } from './site';
import { productSlug, workshopSlug } from './catalog';
import type { Product, Workshop } from './types';

const CTX = 'https://schema.org';

export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export const organizationJsonLd = (description: string = SITE.description) => ({
  '@context': CTX, '@type': 'Organization',
  name: SITE.name, url: siteUrl(), description, email: contactEmail(),
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

const DAY_IRI: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export function workshopJsonLd(w: Workshop) {
  const path = `/workshops/${workshopSlug(w)}`;
  const place = { '@type': 'Place', name: w.venue ?? '', address: { '@type': 'PostalAddress', addressLocality: w.city, ...(w.cityState ? { addressRegion: w.cityState } : {}), addressCountry: 'IN' } };
  const virtual = { '@type': 'VirtualLocation', url: abs(path) }; // the join link is never published; the listing page is the place to find the class
  return {
    '@context': CTX, '@type': 'Event',
    name: w.title, description: w.description, url: abs(path),
    image: [...w.images, abs(`${path}/opengraph-image`)], // the host's own photos first
    startDate: `${w.date}T${w.time}:00+05:30`,
    ...(w.endsOn ? { endDate: w.endsOn } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: w.mode === 'online' ? 'https://schema.org/OnlineEventAttendanceMode' : w.mode === 'hybrid' ? 'https://schema.org/MixedEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
    location: w.mode === 'online' ? virtual : w.mode === 'hybrid' ? [place, virtual] : place,
    organizer: { '@type': 'Organization', name: w.host },
    ...(w.prices.length ? { offers: w.prices.map(p => ({ '@type': 'Offer', name: p.label, price: (p.amountPaise / 100).toFixed(2), priceCurrency: 'INR', url: abs(path), availability: 'https://schema.org/InStock' })) } : {}),
    ...(w.schedule ? { eventSchedule: {
      '@type': 'Schedule', repeatFrequency: w.schedule.repeat === 'monthly' ? 'P1M' : 'P1W', scheduleTimezone: 'Asia/Kolkata', startTime: w.schedule.time, duration: `PT${w.schedule.durationMin}M`,
      byDay: w.schedule.days.map(d => `https://schema.org/${DAY_IRI[d]}`),
      ...(w.schedule.repeat === 'monthly' && w.schedule.weeks ? { byMonthWeek: w.schedule.weeks.map(x => (x === 'last' ? -1 : x)) } : {}), startDate: w.date, ...(w.endsOn ? { endDate: w.endsOn } : {}),
    } } : {}),
  };
}

export const breadcrumbJsonLd = (items: { name: string; path: string }[]) => ({
  '@context': CTX, '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});

/** A category page: a list of the products on this page (name and address only; the products carry their own full markup). */
export const categoryJsonLd = (name: string, path: string, products: Product[]) => ({
  '@context': CTX, '@type': 'CollectionPage', name, url: abs(path),
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: abs(`/products/${productSlug(p)}`) })),
  },
});

/** The exhibition page (/fair): a walk-around of makers' stalls. */
export const fairJsonLd = (description: string, about: string = 'Products and creative workshops from independent makers in India') => ({
  '@context': CTX, '@type': 'WebPage',
  name: 'Craftofy Fair', description, url: abs('/fair'), inLanguage: 'en-IN',
  isPartOf: { '@type': 'WebSite', name: SITE.name, url: siteUrl() },
  about,
});
