import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), unstable_cache: (fn: unknown) => fn }));   // no Next cache outside a request: call straight through
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://craftofy.online' }));

import sitemap from '@/app/sitemap';
import { ShopByCategory } from '@/components/ShopByCategory';
import { createProduct } from '@/lib/admin';
import { createCategory } from '@/lib/categories';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

let sellerId: string;
const add = (name: string, category: string, status = 'APPROVED') =>
  createProduct({ name, category, cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status, sellerId }, admin);

beforeEach(async () => {
  await resetTestDb({ products: [], workshops: [], orders: [], bookings: [], counters: {} } as never);
  sellerId = (await makeSeller('a@x.co', 'Studio A')).id;
  for (const name of ['Brass Work', 'Glass Art']) await createCategory({ name }, 'a@x.co');
});

describe('sitemap', () => {
  it('lists /categories and every category that has products, and no filtered shop address', async () => {
    await add('T-B1', 'Brass Work'); await add('T-G1', 'Glass Art', 'DRAFT');
    const urls = (await sitemap()).map(e => e.url);
    expect(urls).toContain('https://craftofy.online/categories');
    expect(urls).toContain('https://craftofy.online/categories/brass-work');
    expect(urls).not.toContain('https://craftofy.online/categories/glass-art');     // only a draft: no page
    expect(urls.filter(u => u.includes('?'))).toEqual([]);
  });
  it('gives each category page a lastModified: its newest product edit', async () => {
    await add('T-B1', 'Brass Work');
    const entry = (await sitemap()).find(e => e.url.endsWith('/categories/brass-work'));
    expect(entry?.lastModified).toBeInstanceOf(Date);
    expect(Date.now() - (entry!.lastModified as Date).getTime()).toBeLessThan(60_000);
    expect((await sitemap()).find(e => e.url.endsWith('/categories'))?.lastModified).toBeUndefined();
  });
});

describe('ShopByCategory (home page block)', () => {
  it('links to the busiest categories\' pages and to all categories', async () => {
    await add('T-B1', 'Brass Work'); await add('T-B2', 'Brass Work'); await add('T-G1', 'Glass Art');
    const h = renderToStaticMarkup(<>{await ShopByCategory()}</>);
    expect([...h.matchAll(/href="([^"]+)"/g)].map(m => m[1])).toEqual(['/categories', '/categories/brass-work', '/categories/glass-art']);
    expect(h).toContain('Shop by category');
  });
  it('shows at most 8 categories', async () => {
    for (let i = 1; i <= 10; i++) { await createCategory({ name: `Cat ${String.fromCharCode(64 + i)}` }, 'a@x.co'); await add(`T-${i}`, `Cat ${String.fromCharCode(64 + i)}`); }
    const h = renderToStaticMarkup(<>{await ShopByCategory()}</>);
    expect((h.match(/href="\/categories\/[^"]+"/g) ?? []).length).toBe(8);
  });
  it('renders nothing when no category has products', async () => {
    expect(await ShopByCategory()).toBeNull();
  });
});
