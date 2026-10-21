// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/AddToCartButton', () => ({ AddToCartButton: () => <button>add</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: ({ productId, initialCount }: any) => <button data-like={productId}>{`♡ ${initialCount}`}</button> }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: ({ productId, type }: any) => <i data-track={`${type}:${productId}`} /> }));
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: ({ productId, type, ...r }: any) => <a data-tracked={`${type}:${productId}`} {...r} /> }));
const nav = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }) }));
vi.mock('next/navigation', () => nav);
import { TrendingSection } from '@/components/TrendingSection';
import { ProductCard } from '@/components/ProductCard';
import { likeProduct, recordEvent } from '@/lib/engagement';
import { resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); nav.notFound.mockClear(); });
afterEach(cleanup);

describe('TrendingSection (home page)', () => {
  it('renders nothing at all while nothing is trending', async () => {
    expect(await TrendingSection()).toBeNull();
  });
  it('shows a "Trending now" row with a Show all link once something trends, one card per artist', async () => {
    await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' }); await likeProduct('p2', 'v:a');
    render(await TrendingSection());
    expect(screen.getByRole('heading', { name: 'Trending now' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Show all/ }).getAttribute('href')).toBe('/trending');
    expect(document.querySelectorAll('.product-card')).toHaveLength(2);
  });
});

describe('ProductCard', () => {
  it('has a like button with the count, and the card still links to the product', () => {
    const p = { id: 'p1', name: 'Bag', category: 'Pottery', city: 'Jaipur', pricePaise: 100, seller: 'S', description: 'd', stock: 1, status: 'APPROVED', likeCount: 4, sellerSlug: 's-12345678' };
    render(<ProductCard p={p} />);
    expect(document.querySelector('[data-like="p1"]')!.textContent).toBe('♡ 4');
    expect(screen.getByRole('link', { name: 'Bag' }).getAttribute('href')).toBe('/products/bag-p1');
  });
});

describe('/trending page', () => {
  it('lists trending products with breadcrumbs and an honest empty state', async () => {
    const Page = (await import('@/app/trending/page')).default;
    render(await Page());
    expect(screen.getByText('Nothing is trending yet. Like a product to start the trend.')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    cleanup();
    await recordEvent({ productId: 'p1', type: 'view', actor: 'h:a' });
    render(await Page());
    expect(document.querySelectorAll('.product-card')).toHaveLength(1);
  });
});

describe('/artists/[slug] page', () => {
  it('shows the artist, their published products and counts an artist visit only when ?from is one of their products', async () => {
    const { listProducts } = await import('@/lib/catalog');
    const slug = (await listProducts()).find(p => p.id === 'p1')!.sellerSlug!;
    const Page = (await import('@/app/artists/[slug]/page')).default;
    render(await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ from: 'p1' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Shauk and Stuff' })).toBeTruthy();
    expect(document.querySelectorAll('.product-card')).toHaveLength(1);
    expect(document.querySelector('[data-track="artist:p1"]')).toBeTruthy();
    cleanup();
    render(await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ from: 'p3' }) }));   // another artist's product: no credit
    expect(document.querySelector('[data-track]')).toBeNull();
    cleanup();
    render(await Page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({ from: '<script>' }) }));
    expect(document.querySelector('[data-track]')).toBeNull();
  });
  it('is a 404 for unknown artists', async () => {
    const Page = (await import('@/app/artists/[slug]/page')).default;
    await expect(Page({ params: Promise.resolve({ slug: 'nobody-00000000' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  });
});

import fs from 'node:fs';
describe('product page wiring (source contract)', () => {
  const src = fs.readFileSync('src/app/products/[slug]/page.tsx', 'utf8');
  it('records a view, links to the artist page with the product id, and tracks all four contact links', () => {
    expect(src).toContain('<TrackOnMount productId={p.id} type="view" />');
    expect(src).toContain('/artists/${p.sellerSlug}?from=${p.id}');
    expect(src.match(/<TrackedLink productId=\{p\.id\} type="contact"/g)).toHaveLength(4);   // instagram, youtube, phone, email
    expect(src).toContain('<LikeButton');
    expect(src).not.toMatch(/<a href=\{(instagramUrl|youtubeUrl)/);                         // no untracked social links left
  });
});
