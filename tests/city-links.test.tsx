import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => null }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => null }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: () => null }));
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: () => null }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => null }));

import ProductPage from '@/app/products/[slug]/page';
import WorkshopPage from '@/app/workshops/[slug]/page';
import { getDb } from '@/db/client';
import { products, workshops } from '@/db/schema';
import { ensureUser } from '@/db/people';
import { upsertCity } from '@/lib/cities';
import { getProductBySlug, getWorkshopBySlug, productSlug, workshopSlug } from '@/lib/catalog';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb({ products: [], workshops: [], orders: [], bookings: [], counters: {} } as never); });

describe('city links on detail pages use the stored city slug', () => {
  it('a product in Udaipur, Tripura links to /cities/udaipur-tripura, not /cities/udaipur', async () => {
    const db = getDb();
    const tri = await upsertCity(db, { osmType: 'N', osmId: 501, name: 'Udaipur', state: 'Tripura', lat: 23.5, lng: 91.5 });
    expect(tri.slug).toBe('udaipur-tripura');
    const u = await ensureUser(db, 's@x.invalid', 'S');
    await db.insert(products).values({ id: 'p9', sellerId: u.id, name: 'Bowl', category: 'Pottery', cityId: tri.id, pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED' });
    await db.insert(workshops).values({ id: 'w9', title: 'Clay', type: 'FREE', pricePaise: 0, cityId: tri.id, venue: 'V', startsAt: new Date('2026-12-01T10:00:00+05:30'), seats: 5, booked: 0, hostName: 'H', description: 'd', status: 'APPROVED' });
    const p = (await getProductBySlug(productSlug({ id: 'p9', name: 'Bowl' } as never)))!;
    const w = (await getWorkshopBySlug(workshopSlug({ id: 'w9', title: 'Clay' } as never)))!;
    const ph = renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug: productSlug(p) }) }));
    const wh = renderToStaticMarkup(await WorkshopPage({ params: Promise.resolve({ slug: workshopSlug(w) }) }));
    expect(ph).toContain('href="/cities/udaipur-tripura"');
    expect(ph).not.toContain('href="/cities/udaipur"');
    expect(wh).toContain('href="/cities/udaipur-tripura"');
    expect(wh).not.toContain('href="/cities/udaipur"');
  });
});

describe('city links with duplicate names', () => {
  it('cityLabeller adds the state only to names that repeat', async () => {
    const { cityLabeller } = await import('@/lib/city-label');
    const l = cityLabeller([{ name: 'Jaipur', state: 'Rajasthan' }, { name: 'Udaipur', state: 'Rajasthan' }, { name: 'udaipur', state: 'Tripura' }]);
    expect(l({ name: 'Jaipur', state: 'Rajasthan' })).toBe('Jaipur');
    expect(l({ name: 'Udaipur', state: 'Rajasthan' })).toBe('Udaipur, Rajasthan');
    expect(l({ name: 'udaipur', state: 'Tripura' })).toBe('udaipur, Tripura');
  });
});
