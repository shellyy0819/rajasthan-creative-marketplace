// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>add</button> }));
vi.mock('@/components/LikeButton', () => ({ LikeButton: () => <button>like</button> }));
vi.mock('next/server', async orig => ({ ...(await orig<typeof import('next/server')>()), connection: async () => undefined }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'http://localhost:3000' }));
vi.mock('next/navigation', () => ({ notFound: vi.fn(), usePathname: () => '/', useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
// The site words what it sells from the catalogue ("handmade finds"); the home heading must not follow it.
vi.mock('@/lib/catalog-wording', async orig => {
  const m = await orig<typeof import('@/lib/catalog-wording')>();
  return { ...m, getCatalogWording: async () => m.describeCatalog([{ name: 'Handmade', countsAsHandmade: true, count: 5 }], 0, { products: 5, makers: 2, cities: 1 }) };
});
vi.mock('@/components/TrackedLink', () => ({ TrackedLink: ({ productId, type, ...r }: any) => <a data-tracked={`${type}:${productId}`} {...r} /> }));
import { HomeShelf } from '@/components/HomeShelf';
import { createProduct } from '@/lib/admin';
import { DEFAULT_HOME_PRODUCT_LIMIT } from '@/lib/catalog-shared';
import { saveHomeSettings } from '@/lib/home-settings';
import { countProducts } from '@/lib/catalog';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { makeSeller, resetTestDb } from './helpers/testdb';

beforeEach(async () => { await resetTestDb(); });
afterEach(cleanup);

describe('home page product shelf', () => {
  it('shows at most 30 products, however many products there are, with no way to load more', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    for (let i = 0; i < DEFAULT_HOME_PRODUCT_LIMIT + 3; i++) await createProduct({ name: `Extra ${i}`, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
    expect(await countProducts()).toBeGreaterThan(DEFAULT_HOME_PRODUCT_LIMIT);
    render(await HomeShelf());
    expect(DEFAULT_HOME_PRODUCT_LIMIT).toBe(30);
    expect(document.querySelectorAll('.product-card')).toHaveLength(DEFAULT_HOME_PRODUCT_LIMIT);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('shows as many as the admin set on the Settings page', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    for (let i = 0; i < 6; i++) await createProduct({ name: `Extra ${i}`, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId: s.id }, admin);
    await saveHomeSettings({ productLimit: 4 }, 'root@x.co');
    render(await HomeShelf());
    expect(document.querySelectorAll('.product-card')).toHaveLength(4);
  });

  it('has no category filter: those are on /shop only', async () => {
    render(await HomeShelf());
    expect(screen.queryByRole('group', { name: 'Browse by category' })).toBeNull();
    expect(document.querySelector('.craft-tabs')).toBeNull();
    expect(screen.queryByRole('button', { pressed: false })).toBeNull();
  });

  it('the heading is always "Finds", even when the catalogue is worded "handmade finds" or "handmade products"', async () => {
    const Home = (await import('@/app/page')).default;
    const drop = (node: any): any => Array.isArray(node) ? node.map(drop)
      : !React.isValidElement(node) ? node
      : typeof node.type === 'function' && node.type.constructor.name === 'AsyncFunction' ? null
      : (node.props as any)?.children === undefined ? node : React.cloneElement(node, { children: drop((node.props as any).children) } as any);
    const find = (node: any, name: string): any => Array.isArray(node) ? node.map(n => find(n, name)).find(Boolean)
      : !React.isValidElement(node) ? undefined
      : (node.type as { name?: string }).name === name ? node : find((node.props as any)?.children, name);
    const sections = find(await Home(), 'HomeSections');
    expect(sections).toBeTruthy();
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    render(<QueryClientProvider client={new QueryClient()}>{drop(await (sections.type as (p: unknown) => Promise<unknown>)(sections.props))}</QueryClientProvider>);
    expect(screen.getByRole('heading', { level: 2, name: 'Finds' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: /handmade|products/i })).toBeNull();
  });
});
