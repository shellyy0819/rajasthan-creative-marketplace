import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), unstable_cache: (fn: unknown) => fn }));   // no Next cache outside a request: call straight through
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: 'products', finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));

import CategoriesPage, { generateMetadata } from '@/app/categories/page';
import { createProduct } from '@/lib/admin';
import { createCategory } from '@/lib/categories';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

let sellerId: string;
const add = (name: string, category: string, status = 'APPROVED') =>
  createProduct({ name, category, cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status, sellerId }, admin);
const html = async () => renderToStaticMarkup(await CategoriesPage());

beforeEach(async () => {
  await resetTestDb({ products: [], workshops: [], orders: [], bookings: [], counters: {} } as never);
  sellerId = (await makeSeller('a@x.co', 'Studio A')).id;
  for (const name of ['Brass Work', 'Glass Art', 'Zebra Crafts']) await createCategory({ name }, 'a@x.co');
});

describe('categories index page', () => {
  it('lists categories with their product counts as links, sorted by name', async () => {
    await add('T-Z1', 'Zebra Crafts'); await add('T-B1', 'Brass Work'); await add('T-B2', 'Brass Work');
    const h = await html();
    const links = [...h.matchAll(/<a href="(\/categories\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => [m[1], m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()]);
    expect(links).toEqual([['/categories/brass-work', 'Brass Work 2'], ['/categories/zebra-crafts', 'Zebra Crafts 1']]);
    expect(h).toMatch(/<h1[^>]*>Categories<\/h1>/);
  });
  it('leaves out categories with no approved products (empty or only drafts)', async () => {
    await add('T-B1', 'Brass Work'); await add('T-G1', 'Glass Art', 'DRAFT');
    const h = await html();
    expect(h).toContain('Brass Work');
    expect(h).not.toContain('Glass Art');
    expect(h).not.toContain('Zebra Crafts');
  });
  it('shows a message when there are no categories', async () => {
    expect(await html()).toContain('No categories yet');
  });
  it('has the breadcrumb Home › Categories and a canonical to itself', async () => {
    await add('T-B1', 'Brass Work');
    const h = await html();
    expect(h).toMatch(/aria-label="Breadcrumb"[\s\S]*href="\/"[^>]*>Home[\s\S]*aria-current="page">Categories/);
    const m = await generateMetadata();
    expect(m.alternates?.canonical).toBe('/categories');
    expect(m.robots).toBeUndefined();
    expect(String(m.title)).toMatch(/Shop by Category/);
  });
});

describe('categories index: search engines and screen readers', () => {
  it('is noindex while no category has a product, indexable once one does', async () => {
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true });
    await add('T-B1', 'Brass Work');
    expect((await generateMetadata()).robots).toBeUndefined();
  });
  it('announces each count as "N products", not a bare number', async () => {
    await add('T-B1', 'Brass Work'); await add('T-B2', 'Brass Work');
    expect(await html()).toContain('<small aria-label="2 products">2</small>');
  });
});

