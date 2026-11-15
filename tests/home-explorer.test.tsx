// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render as plainRender, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>add</button> }));
import { HomeCraftExplorer } from '@/components/HomeCraftExplorer';

afterEach(cleanup);
// Product cards read like counts through React Query, so every render needs a client.
const render = (ui: React.ReactElement) => plainRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const p = (id: string, name: string, category: string) => ({ id, name, category, city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 10000, seller: 'S', description: 'd', stock: 3, status: 'APPROVED' });
const PRODUCTS = [p('p1', 'Lily Bouquet', 'Crochet & Textiles'), p('p2', 'Frock', 'Crochet & Textiles'), p('p3', 'Coaster Set', 'Resin Art'), p('p4', 'Wood Horse', 'Wooden Toys')];

const COUNTS = [{ name: 'Crochet & Textiles', count: 2 }, { name: 'Resin Art', count: 1 }, { name: 'Wooden Toys', count: 1 }];
const names = () => [...document.querySelectorAll('.product-card h3')].map(h => h.textContent);
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const ok = (items: unknown[]) => json(items);
/** Only the shelf's own page requests; product cards make their own small calls (likes) through the same fetch. */
const pageUrls = (m: { mock: { calls: unknown[][] } }) => m.mock.calls.map(c => String(c[0])).filter(u => u.startsWith('/api/products'));
/** Answers page requests with `pages(url)` and everything else (likes) with an empty object. */
const route = (pages: (url: string) => Promise<Response>) => (url: unknown) => (String(url).startsWith('/api/products') ? pages(String(url)) : json({}));

describe('HomeCraftExplorer uses only real data', () => {
  it('builds its filters from the category counts it was given', () => {
    render(<HomeCraftExplorer initialItems={PRODUCTS} categories={COUNTS} />);
    const group = screen.getByRole("group", { name: /category/i });
    expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual(['All 4', 'Crochet & Textiles 2', 'Resin Art 1', 'Wooden Toys 1']);
  });
  it('invents nothing: no hard-coded collections, craft chips or emoji icons', () => {
    render(<HomeCraftExplorer initialItems={PRODUCTS} categories={COUNTS} />);
    for (const fake of ['Desk', 'Aesthetic decor', 'Gifts & keepsakes', 'Home & décor', 'Leather', 'Crochet finds']) expect(document.body.textContent).not.toContain(fake);
    expect(screen.getByRole('group', { name: /category/i }).textContent).not.toMatch(/\p{Extended_Pictographic}|[⌂❋✳]/u);
  });
  it('categories with no published products are not offered', () => {
    render(<HomeCraftExplorer initialItems={[p('p1', 'Only One', 'Pottery')]} categories={[{ name: 'Pottery', count: 1 }]} />);
    expect(screen.queryByRole('button', { name: /Resin Art/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Pottery/ })).toBeTruthy();
  });
  it('with no products there are no filter buttons, just the empty state', () => {
    render(<HomeCraftExplorer initialItems={[]} categories={[]} />);
    expect(screen.queryByRole("group", { name: /category/i })).toBeNull();
    expect(screen.getByText('No handmade finds yet. Check back soon.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Try another city');
  });
});

describe('HomeCraftExplorer loads a page at a time', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the first page it was given and offers more only while products are left', () => {
    render(<HomeCraftExplorer initialItems={PRODUCTS.slice(0, 2)} categories={COUNTS} />);
    expect(names()).toEqual(['Lily Bouquet', 'Frock']);
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(pageUrls(fetchMock)).toEqual([]);
    cleanup();
    render(<HomeCraftExplorer initialItems={PRODUCTS} categories={COUNTS} />);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
  it('Show more fetches the next page by position and appends it, once', async () => {
    fetchMock.mockImplementation(route(() => ok(PRODUCTS.slice(2))));
    render(<HomeCraftExplorer initialItems={PRODUCTS.slice(0, 2)} categories={COUNTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(names()).toEqual(['Lily Bouquet', 'Frock', 'Coaster Set', 'Wood Horse']));
    expect(pageUrls(fetchMock)).toEqual(['/api/products?limit=8&offset=2']);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
  it('a category loads its own first page from the server, and going back to it later uses what was already fetched', async () => {
    fetchMock.mockImplementation(route(() => ok([PRODUCTS[2]])));
    render(<HomeCraftExplorer initialItems={PRODUCTS} categories={COUNTS} />);
    fireEvent.click(screen.getByRole('button', { name: /Resin Art/ }));
    await waitFor(() => expect(names()).toEqual(['Coaster Set']));
    expect(pageUrls(fetchMock)).toEqual(['/api/products?limit=8&offset=0&category=Resin+Art']);
    expect(document.querySelector('.craft-results-heading')!.textContent).toBe('Resin Art');
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(names()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /Resin Art/ }));
    expect(names()).toEqual(['Coaster Set']);
    expect(pageUrls(fetchMock)).toHaveLength(1);
  });
  it('shows each product once even if a new one shifted it onto the next page', async () => {
    fetchMock.mockImplementation(route(() => ok([PRODUCTS[1], PRODUCTS[2], PRODUCTS[3]])));
    render(<HomeCraftExplorer initialItems={PRODUCTS.slice(0, 2)} categories={COUNTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(names()).toHaveLength(4));
    expect(new Set(names()).size).toBe(4);
  });
  it('says so and lets the visitor try again when a page cannot be loaded', async () => {
    let failed = false;
    fetchMock.mockImplementation(route(() => { if (failed) return ok(PRODUCTS.slice(2)); failed = true; return json({ error: 'nope' }, 500); }));
    render(<HomeCraftExplorer initialItems={PRODUCTS.slice(0, 2)} categories={COUNTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await screen.findByRole('alert');
    expect(names()).toEqual(['Lily Bouquet', 'Frock']);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(names()).toHaveLength(4));
  });
});

describe('empty workshop list on the home page', () => {
  it('says there are none yet instead of asking the visitor to change filters', async () => {
    const { WorkshopList } = await import('@/components/WorkshopList');
    render(<WorkshopList workshops={[]} emptyMessage="No workshops are scheduled yet. Check back soon." />);
    expect(screen.getByText('No workshops are scheduled yet. Check back soon.')).toBeTruthy();
    cleanup();
    render(<WorkshopList workshops={[]} />);
    expect(screen.getByText(/Try a different city or filter/)).toBeTruthy(); // filtered views keep the filter hint
  });
});
