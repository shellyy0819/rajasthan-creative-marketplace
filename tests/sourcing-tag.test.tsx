import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => null }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => null }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: () => null }));
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: () => null }));
vi.mock('@/components/ArtistAvatar', () => ({ ArtistAvatar: () => null }));

import ProductPage from '@/app/products/[slug]/page';
import { ProductCard } from '@/components/ProductCard';
import { getDb } from '@/db/client';
import { products, sourcingTypes } from '@/db/schema';
import { ensureUser } from '@/db/people';
import { upsertCity } from '@/lib/cities';
import { getProductBySlug, productSlug } from '@/lib/catalog';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb({ products: [], workshops: [], orders: [], bookings: [], counters: {} } as never); });

async function product(id: string, typeName: string, showBadge: boolean) {
  const db = getDb();
  const city = await upsertCity(db, { osmType: 'N', osmId: 700 + id.length, name: 'Jaipur', state: 'Rajasthan', lat: 26.9, lng: 75.8 });
  const u = await ensureUser(db, `s-${id}@x.invalid`, 'S');
  const [t] = await db.insert(sourcingTypes).values({ name: typeName, countsAsHandmade: false, showBadge, position: 90 + id.length, active: true }).returning();
  await db.insert(products).values({ id, sellerId: u.id, name: 'Bowl', category: 'Pottery', cityId: city.id, sourcingTypeId: t.id, pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED' });
  return (await getProductBySlug(productSlug({ id, name: 'Bowl' } as never)))!;
}
const page = async (p: { id: string; name: string }) => renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug: productSlug(p as never) }) }));

describe('sourcing tag', () => {
  it('shows on the product page for a type that has its tag switched on', async () => {
    const p = await product('p1', 'Upcycled finds', true);
    const html = await page(p);
    expect(html).toMatch(/<span class="source-tag"[^>]*>Upcycled finds<\/span>/);
  });
  it('is left off the product page when the type has its tag switched off', async () => {
    const p = await product('p22', 'Plain label', false);
    expect(await page(p)).not.toContain('source-tag');
  });
  it('is never on a card, even when the type has its tag on', async () => {
    const p = await product('p333', 'Vintage lot', true);
    expect(p.sourcing?.showBadge).toBe(true);
    const card = renderToStaticMarkup(<ProductCard p={p} />);
    expect(card).not.toContain('Vintage lot');
    expect(card).not.toContain('source-tag');
  });
});
