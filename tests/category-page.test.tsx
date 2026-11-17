import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/components/ProductGrid', () => ({ ProductGrid: ({ products }: any) => <ul className="grid">{products.map((p: any) => <li key={p.id}><a href={`/products/${p.id}`}>{p.name}</a></li>)}</ul> }));
const wording = vi.hoisted(() => ({ products: 'products' }));
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: wording.products, finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } }) }));

import CategoryPage, { generateMetadata } from '@/app/categories/[slug]/page';
import { createProduct } from '@/lib/admin';
import { createCategory } from '@/lib/categories';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

let sellerId: string;
const add = (name: string, category: string, status = 'APPROVED') =>
  createProduct({ name, category, cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status, sellerId }, admin);
const props = (slug: string, sp: Record<string, string> = {}) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) });
const html = async (slug: string, sp: Record<string, string> = {}) => renderToStaticMarkup(await CategoryPage(props(slug, sp)));
const jsonLd = (h: string) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1].replace(/\\u003c/g, '<')));

beforeEach(async () => {
  wording.products = 'products';
  await resetTestDb();
  sellerId = (await makeSeller('a@x.co', 'Studio A')).id;
  for (const name of ['Brass Work', 'Glass Art']) await createCategory({ name }, 'a@x.co');
  await add('T-B1', 'Brass Work'); await add('T-B2', 'Brass Work');
});

describe('category page', () => {
  it('shows the h1, the breadcrumb Home › Categories › Name, the intro and the products', async () => {
    const h = await html('brass-work');
    expect(h).toMatch(/<h1[^>]*>Brass Work<\/h1>/);
    expect(h).toContain('T-B1'); expect(h).toContain('T-B2');
    expect(h).toMatch(/aria-label="Breadcrumb"[\s\S]*href="\/"[^>]*>Home[\s\S]*href="\/categories"[^>]*>Categories[\s\S]*aria-current="page">Brass Work/);
    expect(h).toMatch(/Browse 2 products in Brass Work/);
  });
  it('404s for an unknown slug and for a category with no approved products', async () => {
    await expect(html('nope')).rejects.toThrow('NOT_FOUND');
    await expect(html('glass-art')).rejects.toThrow('NOT_FOUND');      // exists, has no products
    await add('T-G1', 'Glass Art', 'DRAFT');
    await expect(html('glass-art')).rejects.toThrow('NOT_FOUND');      // only a draft
  });
  it('page 2 shows the next products; ?page=0, ?page=abc, ?page=1.5 and a page past the end are 404; ?page=1 is page 1', async () => {
    for (let i = 3; i <= 14; i++) await add(`T-B${i}`, 'Brass Work');
    const p1 = await html('brass-work'), p1b = await html('brass-work', { page: '1' }), p2 = await html('brass-work', { page: '2' });
    expect(p1b).toBe(p1);
    expect(p1).toContain('T-B12'); expect(p1).not.toContain('T-B13');
    expect(p2).toContain('T-B13'); expect(p2).toContain('T-B14'); expect(p2).not.toContain('T-B1<');
    for (const bad of ['0', 'abc', '1.5', '-1', '3', '99', '']) await expect(html('brass-work', { page: bad })).rejects.toThrow('NOT_FOUND');
  });
  it('pagination links are real links, prev only after page 1 and next only before the last page', async () => {
    for (let i = 3; i <= 14; i++) await add(`T-B${i}`, 'Brass Work');
    const p1 = await html('brass-work'), p2 = await html('brass-work', { page: '2' });
    expect(p1).toMatch(/<a[^>]*href="\/categories\/brass-work\?page=2"[^>]*rel="next"/);
    expect(p1).not.toContain('rel="prev"');
    expect(p2).toMatch(/<a[^>]*href="\/categories\/brass-work"[^>]*rel="prev"/);      // back to page 1 is the base address
    expect(p2).not.toContain('rel="next"');
    expect(p1).toContain('aria-label="Pages"');
    expect(p1).toContain('Page 1 of 2');
  });
  it('a single page has no pagination', async () => {
    expect(await html('brass-work')).not.toContain('aria-label="Pages"');
  });
  it('JSON-LD has a breadcrumb and an item list of this page\'s products', async () => {
    const ld = jsonLd(await html('brass-work'));
    expect(ld.some(d => d['@type'] === 'BreadcrumbList')).toBe(true);
    const list = ld.find(d => d['@type'] === 'CollectionPage');
    expect(list.mainEntity.itemListElement.map((i: any) => i.name)).toEqual(['T-B1', 'T-B2']);
    expect(list.mainEntity.itemListElement[0].url).toMatch(/\/products\/t-b1-p\d+$/);
  });
});

describe('category page metadata', () => {
  it('page 1: canonical is the base address and the page is indexable', async () => {
    const m = await generateMetadata(props('brass-work'));
    expect(m.alternates?.canonical).toBe('/categories/brass-work');
    expect(m.robots).toBeUndefined();
    expect(String(m.title)).toBe('Brass Work: Products from Indian Artisans');
  });
  it('page N is its own canonical address and says which page it is', async () => {
    for (let i = 3; i <= 14; i++) await add(`T-B${i}`, 'Brass Work');
    const m = await generateMetadata(props('brass-work', { page: '2' }));
    expect(m.alternates?.canonical).toBe('/categories/brass-work?page=2');
    expect(String(m.title)).toContain('page 2');
    expect(m.robots).toBeUndefined();
  });
  it('any other parameter (city, sort, q, source) gives noindex, follow and a canonical to the category page', async () => {
    for (const sp of [{ city: 'jaipur' }, { sort: 'new' }, { q: 'x' }, { source: 'Handmade' }, { page: '1', city: 'jaipur' }] as Record<string, string>[]) {
      const m = await generateMetadata(props('brass-work', sp));
      expect(m.robots).toEqual({ index: false, follow: true });
      expect(m.alternates?.canonical).toBe('/categories/brass-work');
    }
  });
  it('a page that will 404 (too high, 0, abc) is never indexed, even though the response may stream as a 200', async () => {
    for (const page of ['2', '99', '0', 'abc', '1.5']) expect((await generateMetadata(props('brass-work', { page }))).robots).toEqual({ index: false });
  });
  it('an unknown slug is not indexed', async () => {
    expect((await generateMetadata(props('nope'))).robots).toEqual({ index: false });
  });
  it('the wording follows what the catalogue may claim: handmade only when true', async () => {
    wording.products = 'handmade products';
    expect(String((await generateMetadata(props('brass-work'))).title)).toBe('Brass Work: Handmade products from Indian Artisans');
    expect(await html('brass-work')).toMatch(/Browse 2 handmade products in Brass Work/);
  });
});
