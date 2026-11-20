import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next/cache', async orig => ({ ...(await orig<typeof import('next/cache')>()), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock('@/components/ProductGrid', () => ({ ProductGrid: ({ products }: any) => <ul>{products.map((p: any) => <li key={p.id}>{p.name}</li>)}</ul> }));
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: 'products', finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } }) }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));

import CategoryPage, { generateMetadata } from '@/app/categories/[slug]/page';
import { PATCH } from '@/app/api/categories/[slug]/route';
import { createProduct } from '@/lib/admin';
import { createCategory } from '@/lib/categories';
import { MAX_CATEGORY_DESCRIPTION, getCategoryEntry, setCategoryDescription } from '@/lib/category-pages';
import { makeSeller, resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';
import { admin } from './helpers/actors';

const TEXT = 'Hand-thrown pots from Jaipur and Khurja, glazed in the blues and ochres of Rajasthan. Each piece is shaped on a wheel and fired by one maker. Contact the potter directly to order.';
let sellerId: string;
const add = (name: string, category: string) =>
  createProduct({ name, category, cityRef: cityRef('Jaipur'), pricePaise: 100, description: 'd', stock: 1, status: 'APPROVED', sellerId }, admin);
const props = (slug: string, sp: Record<string, string> = {}) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) });
const html = async (slug: string) => renderToStaticMarkup(await CategoryPage(props(slug)));
const patch = (slug: string, body: unknown) => PATCH(new Request(`http://x/api/categories/${slug}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ slug }) });
const as = (role: string) => authMock.mockResolvedValue({ user: { email: `${role}@x.co`, role } });

beforeEach(async () => {
  authMock.mockReset(); authMock.mockResolvedValue(null);
  await resetTestDb();
  sellerId = (await makeSeller('a@x.co', 'Studio A')).id;
  for (const name of ['Brass Work', 'Glass Art']) await createCategory({ name }, 'a@x.co');
  await add('T-B1', 'Brass Work'); await add('T-G1', 'Glass Art');
});

describe('category description: library', () => {
  it('a new category has an empty description', async () => {
    expect((await getCategoryEntry('brass-work'))?.description).toBe('');
  });
  it('is saved trimmed with inner whitespace collapsed, and an empty text clears it', async () => {
    await setCategoryDescription('brass-work', `  Brass   lamps\n and bells.  `);
    expect((await getCategoryEntry('brass-work'))?.description).toBe('Brass lamps and bells.');
    await setCategoryDescription('brass-work', '   ');
    expect((await getCategoryEntry('brass-work'))?.description).toBe('');
  });
  it('rejects a non-string, control characters and a text over the limit (400); an unknown slug is 404', async () => {
    await expect(setCategoryDescription('brass-work', 5)).rejects.toMatchObject({ status: 400 });
    await expect(setCategoryDescription('brass-work', 'a\u0000b')).rejects.toMatchObject({ status: 400 });
    await expect(setCategoryDescription('brass-work', 'x'.repeat(MAX_CATEGORY_DESCRIPTION + 1))).rejects.toMatchObject({ status: 400 });
    await expect(setCategoryDescription('nope', 'x')).rejects.toMatchObject({ status: 404 });
    await setCategoryDescription('brass-work', 'x'.repeat(MAX_CATEGORY_DESCRIPTION));
  });
  it('a category with no products can still be described (before it gets its first product)', async () => {
    await createCategory({ name: 'Toys' }, 'a@x.co');
    await setCategoryDescription('toys', 'Wooden toys.');
  });
});

describe('category description: page and meta description', () => {
  it('shows the description as the intro, and uses it as the meta description', async () => {
    await setCategoryDescription('brass-work', TEXT);
    const h = await html('brass-work');
    expect(h).toContain(TEXT);
    expect(h).not.toMatch(/Browse 1 products in Brass Work/);
    const meta = await generateMetadata(props('brass-work'));
    expect(TEXT.length).toBeGreaterThan(160);
    expect(meta.description).toBe(TEXT.slice(0, 159).trimEnd() + '…');   // cut to 160 characters like every other page
  });
  it('a short description is the meta description as it is', async () => {
    await setCategoryDescription('brass-work', 'Brass lamps and bells.');
    expect((await generateMetadata(props('brass-work'))).description).toBe('Brass lamps and bells.');
  });
  it('two categories with different descriptions give different intros and meta descriptions', async () => {
    await setCategoryDescription('brass-work', 'Brass lamps.'); await setCategoryDescription('glass-art', 'Glass beads.');
    expect(await html('brass-work')).not.toContain('Glass beads.');
    expect((await generateMetadata(props('glass-art'))).description).toBe('Glass beads.');
  });
  it('without a description the page keeps today\'s generic intro and meta description', async () => {
    expect(await html('brass-work')).toMatch(/Browse 1 products in Brass Work/);
    expect((await generateMetadata(props('brass-work'))).description).toMatch(/^Browse 1 products in Brass Work/);
  });
  it('HTML in a description is escaped, never rendered', async () => {
    await setCategoryDescription('brass-work', '<img src=x onerror=alert(1)> bells');
    const h = await html('brass-work');
    expect(h).not.toContain('<img src=x');
    expect(h).toContain('&lt;img src=x');
  });
});

describe('PATCH /api/categories/[slug]', () => {
  it('is admin only: 401 anonymous, 403 for customers and sellers', async () => {
    expect((await patch('brass-work', { description: 'x' })).status).toBe(401);
    as('customer'); expect((await patch('brass-work', { description: 'x' })).status).toBe(403);
    as('seller'); expect((await patch('brass-work', { description: 'x' })).status).toBe(403);
    expect((await getCategoryEntry('brass-work'))?.description).toBe('');
  });
  it('an admin saves the description (200, returns it); bad input is 400, an unknown slug 404', async () => {
    as('admin');
    const ok = await patch('brass-work', { description: TEXT });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ slug: 'brass-work', description: TEXT });
    expect((await getCategoryEntry('brass-work'))?.description).toBe(TEXT);
    expect((await patch('brass-work', { description: 5 })).status).toBe(400);
    expect((await patch('brass-work', {})).status).toBe(400);
    expect((await patch('nope', { description: 'x' })).status).toBe(404);
  });
});
