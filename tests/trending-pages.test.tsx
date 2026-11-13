// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
// The footer calls connection() to stay per-request; outside Next there is no request scope.
vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: ({ workshop }: any) => <button>reserve {workshop.id}</button> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>add</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: ({ productId, initialCount }: any) => <button data-like={productId}>{`♡ ${initialCount}`}</button> }));
vi.mock('@/components/TrackOnMount', () => ({ TrackOnMount: ({ productId, type }: any) => <i data-track={`${type}:${productId}`} /> }));
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: ({ productId, type, ...r }: any) => <a data-tracked={`${type}:${productId}`} {...r} /> }));
const nav = vi.hoisted(() => ({ notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }) }));
vi.mock('next/navigation', () => nav);
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrendingSection } from '@/components/TrendingSection';
import { HomeShelf } from '@/components/HomeShelf';
import { HomeWorkshops } from '@/components/HomeWorkshops';
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
    await recordEvent({ productId: 'p1', type: 'contact', actor: 'h:a' }); await likeProduct('p2', 'v:a');
    render(await TrendingSection());
    expect(screen.getByRole('heading', { name: 'Trending now' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Show all/ }).getAttribute('href')).toBe('/trending');
    expect(document.querySelectorAll('.product-card')).toHaveLength(2);
  });
});

describe('ProductCard', () => {
  it('has a like button with the count, and the card still links to the product', () => {
    const p = { id: 'p1', name: 'Bag', category: 'Pottery', city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 100, seller: 'S', description: 'd', stock: 1, status: 'APPROVED', likeCount: 4, sellerSlug: 's-12345678' };
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
    await recordEvent({ productId: 'p1', type: 'contact', actor: 'h:a' });
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
    expect(document.querySelectorAll('a.ah-card')).toHaveLength(1);        // the hero shows the piece; no repeated grid for 3 or fewer
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

describe('city listings come from active cities', () => {
  // Jaipur's only product/workshop rows become ARCHIVED, so Jaipur is no longer an active city.
  const archiveJaipur = async () => {
    const { inArray } = await import('drizzle-orm');
    const { getDb } = await import('@/db/client');
    const { products, workshops } = await import('@/db/schema');
    await getDb().update(products).set({ status: 'ARCHIVED' }).where(inArray(products.id, ['p3', 'p4']));
    await getDb().update(workshops).set({ status: 'ARCHIVED' }).where(inArray(workshops.id, ['w2']));
  };
  const cityPage = async (city: string) => (await import('@/app/cities/[city]/page')).default({ params: Promise.resolve({ city }) });

  it('the city page renders an active city with its products and workshops', async () => {
    render(await cityPage('udaipur'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Handmade products & workshops in Udaipur');
    expect(document.querySelectorAll('.product-card')).toHaveLength(2);
  });
  it('the city page for a city with only archived products calls notFound', async () => {
    await archiveJaipur();
    await expect(cityPage('jaipur')).rejects.toThrow('NOT_FOUND');
    expect(nav.notFound).toHaveBeenCalled();
  });
  it('the city page for an unknown slug, or a city with nothing at all, calls notFound', async () => {
    await expect(cityPage('atlantis')).rejects.toThrow('NOT_FOUND');
    const { getDb } = await import('@/db/client');
    const { upsertCity } = await import('@/lib/cities');
    await upsertCity(getDb(), { osmType: 'N', osmId: 99, name: 'Kota', state: 'Rajasthan', lat: 25.2, lng: 75.8 });
    await expect(cityPage('kota')).rejects.toThrow('NOT_FOUND');
  });
  it('the city page has no static params list any more (any active city works)', async () => {
    const mod = await import('@/app/cities/[city]/page');
    expect(mod).not.toHaveProperty('generateStaticParams');
    expect(mod).not.toHaveProperty('dynamicParams');
    expect(mod.dynamic).toBe('force-dynamic');
  });
  it('city page metadata names the city, and an inactive city is noindex', async () => {
    const { generateMetadata } = await import('@/app/cities/[city]/page');
    expect((await generateMetadata({ params: Promise.resolve({ city: 'jodhpur' }) })).description).toContain('Jodhpur');
    await archiveJaipur();
    expect((await generateMetadata({ params: Promise.resolve({ city: 'jaipur' }) })).robots).toEqual({ index: false });
  });
  it('sitemap lists only active cities', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const cityUrls = async () => (await sitemap()).map(e => e.url).filter(u => u.includes('/cities/')).map(u => u.replace(/^.*\/cities\//, ''));
    expect(await cityUrls()).toEqual(['jaipur', 'jodhpur', 'udaipur']);
    await archiveJaipur();
    expect(await cityUrls()).toEqual(['jodhpur', 'udaipur']);
  });
  // SKIPPED on purpose: Footer.tsx has the Cities column commented out (the owner's choice in PR #7). Remove the skip when it comes back.
  it.skip('the footer links every active city and drops one whose last listing is archived', async () => {
    const { Footer } = await import('@/components/Footer');
    render(await Footer());
    const links = () => Array.from(screen.getByRole('navigation', { name: 'Cities' }).querySelectorAll('a')).map(a => [a.textContent, a.getAttribute('href')]);
    expect(links()).toEqual([['Jaipur', '/cities/jaipur'], ['Jodhpur', '/cities/jodhpur'], ['Udaipur', '/cities/udaipur']]);
    cleanup();
    await archiveJaipur();
    render(await Footer());
    expect(links().map(l => l[0])).toEqual(['Jodhpur', 'Udaipur']);
  });
  it('the home page "Explore by city" row lists active cities only', async () => {
    await archiveJaipur();
    const Home = (await import('@/app/page')).default;
    // The page tree holds the async TrendingSection, HomeShelf and HomeWorkshops (streamed behind skeletons); jsdom cannot render async components.
    const drop = (node: any): any => Array.isArray(node) ? node.map(drop)
      : !React.isValidElement(node) ? node
      : [TrendingSection, HomeShelf, HomeWorkshops].includes(node.type as never) ? null
      : (node.props as any)?.children === undefined ? node : React.cloneElement(node, { children: drop((node.props as any).children) } as any);
    render(drop(await Home()));
    const row = screen.getByRole('navigation', { name: 'Explore by city' });
    expect(Array.from(row.querySelectorAll('a')).map(a => a.getAttribute('href'))).toEqual(['/cities/jodhpur', '/cities/udaipur']);
  });
  it('shop and workshops pages pass the active cities to the filter and no longer name the three launch cities', async () => {
    const Shop = await import('@/app/shop/page');
    render(<QueryClientProvider client={new QueryClient()}>{await Shop.default({ searchParams: Promise.resolve({}) })}</QueryClientProvider>);
    expect(Array.from((screen.getByLabelText('Filter by city') as HTMLSelectElement).options).map(o => o.textContent)).toEqual(['All', 'Jaipur', 'Jodhpur', 'Udaipur']);
    const shopMeta = await Shop.generateMetadata({ searchParams: Promise.resolve({}) });
    expect(String(shopMeta.description)).not.toMatch(/Udaipur|Jaipur|Jodhpur/);
    expect(document.querySelector('.page-head')!.textContent).not.toMatch(/Udaipur|Jaipur|Jodhpur/);
    cleanup();
    await archiveJaipur();
    const Ws = await import('@/app/workshops/page');
    render(<QueryClientProvider client={new QueryClient()}>{await Ws.default({ searchParams: Promise.resolve({}) })}</QueryClientProvider>);
    expect(Array.from((screen.getByLabelText('Filter by city') as HTMLSelectElement).options).map(o => o.textContent)).toEqual(['All', 'Jodhpur', 'Udaipur']);
    expect(String((await Ws.generateMetadata({ searchParams: Promise.resolve({}) })).description)).not.toMatch(/Udaipur|Jaipur|Jodhpur/);
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
