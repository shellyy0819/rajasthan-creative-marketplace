import { describe, it, expect, beforeEach } from 'vitest';
import { serializeJsonLd, productJsonLd, workshopJsonLd, breadcrumbJsonLd, organizationJsonLd } from '@/lib/jsonld';
import type { Product, Workshop } from '@/lib/types';

beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = 'https://rr.test'; });

const product: Product = { id: 'p1', name: 'Crochet Lily Bouquet', category: 'Crochet & Textiles', city: 'Udaipur', cityId: 1, citySlug: 'udaipur', pricePaise: 85000, seller: 'Shauk and Stuff', description: 'Handmade.', stock: 8, status: 'APPROVED' };
const workshop: Workshop = { id: 'w1', title: 'Beginner Crochet', type: 'PAID', pricePaise: 49900, city: 'Udaipur', cityId: 1, citySlug: 'udaipur', cityState: 'Rajasthan', venue: 'The Courtyard Café', date: '2026-11-08', time: '11:00', seats: 12, booked: 3, host: 'Shauk and Stuff', description: 'Fun.', status: 'APPROVED' };

describe('serializeJsonLd', () => {
  it('escapes < so </script> cannot break out', () => {
    const s = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('<');
    expect(JSON.parse(s).name).toBe('</script><script>alert(1)</script>');
  });
});

describe('productJsonLd', () => {
  it('has offer in INR with decimal price, InStock, absolute url + image', () => {
    const j = productJsonLd(product) as any;
    expect(j['@type']).toBe('Product');
    expect(j.offers).toMatchObject({ '@type': 'Offer', priceCurrency: 'INR', price: '850.00', availability: 'https://schema.org/InStock', url: 'https://rr.test/products/crochet-lily-bouquet-p1' });
    expect(j.image[0]).toBe('https://rr.test/products/crochet-lily-bouquet-p1/opengraph-image');
    expect(j.brand).toMatchObject({ '@type': 'Brand', name: 'Shauk and Stuff' });
  });
  it('OutOfStock when stock is 0', () => {
    expect((productJsonLd({ ...product, stock: 0 }) as any).offers.availability).toBe('https://schema.org/OutOfStock');
  });
});

describe('workshopJsonLd', () => {
  it('builds an Event with IST start date, offline mode, capacity', () => {
    const j = workshopJsonLd(workshop) as any;
    expect(j['@type']).toBe('Event');
    expect(j.startDate).toBe('2026-11-08T11:00:00+05:30');
    expect(j.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
    expect(j.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(j.location).toMatchObject({ '@type': 'Place', name: 'The Courtyard Café', address: { addressLocality: 'Udaipur', addressRegion: 'Rajasthan', addressCountry: 'IN' } });
    expect(j.remainingAttendeeCapacity).toBe(9);
    expect(j.offers).toMatchObject({ price: '499.00', availability: 'https://schema.org/InStock' });
  });
  it('omits addressRegion when the city has no state', () => {
    const { cityState: _s, ...noState } = workshop;
    const j = workshopJsonLd(noState) as any;
    expect(j.location.address).not.toHaveProperty('addressRegion');
    expect(j.location.address).toMatchObject({ addressLocality: 'Udaipur', addressCountry: 'IN' });
  });
  it('uses the city state for addressRegion', () => {
    const j = workshopJsonLd({ ...workshop, city: 'Indore', cityState: 'Madhya Pradesh' }) as any;
    expect(j.location.address.addressRegion).toBe('Madhya Pradesh');
  });
  it('SoldOut when full; free price is 0.00', () => {
    const j = workshopJsonLd({ ...workshop, booked: 12, type: 'FREE', pricePaise: 0 }) as any;
    expect(j.offers.availability).toBe('https://schema.org/SoldOut');
    expect(j.offers.price).toBe('0.00');
  });
});

describe('breadcrumb + org', () => {
  it('breadcrumb positions start at 1 with absolute items', () => {
    const j = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]) as any;
    expect(j.itemListElement[1]).toMatchObject({ position: 2, name: 'Shop', item: 'https://rr.test/shop' });
  });
  it('organization has name and url', () => {
    expect(organizationJsonLd()).toMatchObject({ '@type': 'Organization', name: 'Craftology', url: 'https://rr.test' });
  });
});

describe('productJsonLd imageUrl', () => {
  it('lists the admin-provided image first, then the generated OG image', () => {
    const j = productJsonLd({ ...product, imageUrl: 'https://cdn.example.com/a.jpg' }) as any;
    expect(j.image[0]).toBe('https://cdn.example.com/a.jpg');
    expect(j.image[1]).toBe('https://rr.test/products/crochet-lily-bouquet-p1/opengraph-image');
  });
});
