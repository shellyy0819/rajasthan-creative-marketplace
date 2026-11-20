import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), unstable_cache: (fn: unknown) => fn }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => null }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => null }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => null }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: () => null }));
vi.mock('@/components/TrackSellerProfileView', () => ({ TrackSellerProfileView: () => null }));
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: () => null }));
vi.mock('@/components/ArtistAvatar', () => ({ ArtistAvatar: () => null }));
vi.mock('@/components/ProductGrid', () => ({ ProductGrid: () => null }));
vi.mock('@/components/RelatedProducts', () => ({ RelatedProducts: () => null }));
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: 'products', finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } }) }));
const data = vi.hoisted(() => ({ getArtist: vi.fn(), on: true }));
vi.mock('@/lib/artists', async orig => ({ ...(await orig<typeof import('@/lib/artists')>()), getArtist: data.getArtist }));
// The gate itself is tested in share-settings.test.tsx: here it is a marker, so the test shows where each page puts it and what it passes
vi.mock('@/components/Share', () => ({
  Share: async (p: any) => data.on ? <button data-share="" data-kind={p.kind} data-path={p.path} data-title={p.title} data-by={p.by ?? ''} data-sub={p.subtitle ?? ''} data-item={p.itemId ?? ''}>Share</button> : null,
}));

import ArtistPage from '@/app/artists/[slug]/page';
import CategoryPage from '@/app/categories/[slug]/page';
import ProductPage from '@/app/products/[slug]/page';
import WorkshopPage from '@/app/workshops/[slug]/page';
import { createProduct, createWorkshop } from '@/lib/admin';
import { productSlug, workshopSlug } from '@/lib/catalog-shared';
import { getProductBySlug } from '@/lib/catalog';
import { createCategory } from '@/lib/categories';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';
import { makeSeller, resetTestDb } from './helpers/testdb';

const EMPTY = { products: [], workshops: [], orders: [], bookings: [], counters: {} } as never;
const marker = (h: string) => { const m = h.match(/<button data-share=""([^>]*)>/); return m ? Object.fromEntries([...m[1].matchAll(/data-(\w+)="([^"]*)"/g)].map(x => [x[1], x[2].replace(/&amp;/g, '&')])) : null; };
const inside = (h: string, cls: string) => new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[\\s\\S]*?data-share=""`).test(h);

const online = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2026-01-05', host: 'Asha Rao', description: 'Gentle hatha yoga.', status: 'APPROVED', schedule: { days: ['mon', 'wed'], time: '07:00', durationMin: 60 }, languages: ['English'], level: 'beginner', whatsapp: '9989898999', prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }] };
const inPerson = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.', status: 'APPROVED' };

beforeEach(async () => { data.on = true; await resetTestDb(EMPTY); });

describe('Share on a product page', () => {
  it('sits in the like strip and names the product, its maker and city, and its id', async () => {
    const seller = await makeSeller('a@x.co', 'Studio A');
    await createCategory({ name: 'Pottery' }, 'a@x.co');
    const created = await createProduct({ name: 'Blue Vase', category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId: seller.id }, admin);
    const p = (await getProductBySlug(productSlug({ id: created.id, name: 'Blue Vase' } as never)))!;
    const h = renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug: productSlug(p) }) }));
    expect(marker(h)).toMatchObject({ kind: 'product', path: `/products/${productSlug(p)}`, title: 'Blue Vase', by: 'Studio A', sub: 'Studio A · Jaipur', item: p.id });
    expect(inside(h, 'detail-like')).toBe(true);
    data.on = false;
    expect(renderToStaticMarkup(await ProductPage({ params: Promise.resolve({ slug: productSlug(p) }) }))).not.toContain('data-share');
  });
});

describe('Share on a workshop page', () => {
  it('an online class and an in-person workshop both show it under the hero details, with the host and the workshop address', async () => {
    for (const [input, sub] of [[online, 'Asha Rao · Online'], [inPerson, 'Marwar Lac · Jodhpur']] as const) {
      const w = await createWorkshop(input as never);
      const h = renderToStaticMarkup(await WorkshopPage({ params: Promise.resolve({ slug: workshopSlug(w) }) }));
      expect(marker(h)).toMatchObject({ kind: 'workshop', path: `/workshops/${workshopSlug(w)}`, title: w.title, by: w.host, sub, item: w.id });
      expect(inside(h, 'share-slot')).toBe(true);
      data.on = false;
      expect(renderToStaticMarkup(await WorkshopPage({ params: Promise.resolve({ slug: workshopSlug(w) }) }))).not.toContain('data-share');
      data.on = true;
    }
  });
});

describe('Share on an artist page', () => {
  const artist = { name: 'Shauk and Stuff', slug: 'shauk-12345678', city: 'Udaipur', logoUrl: undefined, products: [{ id: 'p1', name: 'Piece', category: 'Crochet', city: 'Udaipur', cityId: 1, citySlug: 'u', pricePaise: 10000, seller: 'Shauk and Stuff', description: 'd', stock: 3, status: 'APPROVED', sellerSlug: 'shauk-12345678' }] };
  it('sits with the hero\'s buttons and shares the artist page', async () => {
    data.getArtist.mockResolvedValue(artist);
    const h = renderToStaticMarkup(await ArtistPage({ params: Promise.resolve({ slug: artist.slug }), searchParams: Promise.resolve({}) }));
    expect(marker(h)).toMatchObject({ kind: 'artist', path: '/artists/shauk-12345678', title: 'Shauk and Stuff', sub: 'Udaipur' });
    expect(inside(h, 'ah-acts')).toBe(true);
    data.on = false;
    expect(renderToStaticMarkup(await ArtistPage({ params: Promise.resolve({ slug: artist.slug }), searchParams: Promise.resolve({}) }))).not.toContain('data-share');
  });
});

describe('Share on a category page', () => {
  it('sits under the intro in the page head and shares the category address, not the page number', async () => {
    const seller = await makeSeller('a@x.co', 'Studio A');
    await createCategory({ name: 'Brass Work' }, 'a@x.co');
    await createProduct({ name: 'T-B1', category: 'Brass Work', cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId: seller.id }, admin);
    const h = renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ slug: 'brass-work' }), searchParams: Promise.resolve({}) }));
    expect(marker(h)).toMatchObject({ kind: 'category', path: '/categories/brass-work', title: 'Brass Work', sub: '1 products' });
    expect(inside(h, 'share-slot')).toBe(true);
    data.on = false;
    expect(renderToStaticMarkup(await CategoryPage({ params: Promise.resolve({ slug: 'brass-work' }), searchParams: Promise.resolve({}) }))).not.toContain('data-share');
  });
});
