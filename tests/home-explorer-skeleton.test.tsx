// @vitest-environment jsdom
import fs from 'node:fs';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as plainRender, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ContactArtistButton', () => ({ ContactArtistButton: () => <button>add</button> }));
import { HomeCraftExplorer } from '@/components/HomeCraftExplorer';
import { ProductCard } from '@/components/ProductCard';
import { ProductCardSkeleton } from '@/components/ProductCardSkeleton';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const render = (ui: React.ReactElement) => plainRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const p = (id: string, name: string, category: string) => ({ id, name, category, city: 'Jaipur', cityId: 1, citySlug: 'jaipur', pricePaise: 10000, seller: 'S', description: 'd', stock: 3, status: 'APPROVED' });
const COUNTS = [{ name: 'Crochet', count: 2 }, { name: 'Resin Art', count: 1 }, { name: 'Painting', count: 12 }];
const FIRST = [p('p1', 'Lily', 'Crochet'), p('p2', 'Frock', 'Crochet')];

describe('opening a filter on the home page', () => {
  it('shows card-shaped skeletons (one per product the filter has, one page at most), and no spinner or "Loading" text', async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn((url: unknown) => String(url).startsWith('/api/products') ? new Promise<Response>(res => { release = res; }) : Promise.resolve(new Response('{}'))));
    render(<HomeCraftExplorer initialItems={FIRST as never} categories={COUNTS} />);
    fireEvent.click(screen.getByRole('button', { name: /Painting/ }));
    await waitFor(() => expect(document.querySelectorAll('.product-card-skeleton')).toHaveLength(8)); // 12 products, a page is 8
    expect(document.querySelector('.page-loader, [role="progressbar"], .loader-card')).toBeNull();
    expect(document.body.textContent).not.toContain('Loading finds…');
    expect(document.querySelector('.empty')).toBeNull();
    // the words inside the skeleton are hidden from screen readers; one status line says what is happening
    expect(document.querySelector('.product-card-skeleton')!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Loading finds');
    release(new Response(JSON.stringify([p('p9', 'Landscape', 'Painting')]), { status: 200 }));
    await waitFor(() => expect(document.querySelectorAll('.product-card-skeleton')).toHaveLength(0));
    expect(screen.getByText('Landscape')).toBeTruthy();
  });
  it('a filter with one product shows one skeleton, so the grid does not change length when it arrives', async () => {
    vi.stubGlobal('fetch', vi.fn((url: unknown) => String(url).startsWith('/api/products') ? new Promise<Response>(() => {}) : Promise.resolve(new Response('{}'))));
    render(<HomeCraftExplorer initialItems={FIRST as never} categories={COUNTS} />);
    fireEvent.click(screen.getByRole('button', { name: /Resin Art/ }));
    await waitFor(() => expect(document.querySelectorAll('.product-card-skeleton')).toHaveLength(1));
  });
});

describe('the skeleton card is the real card without its words', () => {
  const classes = (html: string) => new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  it('uses every structural class the real card uses, so laptop and phone sizes come from the same CSS', () => {
    const real = classes(renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ProductCard p={p('p1', 'Lily', 'Crochet') as never} /></QueryClientProvider>));
    const skel = classes(renderToStaticMarkup(<ProductCardSkeleton />));
    for (const c of ['product-card', 'product-visual', 'pc-top', 'pc-chips', 'pc-chip', 'like-btn', 'product-info', 'pc-who', 'pc-av', 'product-bottom', 'price']) {
      expect(real.has(c), `real card has ${c}`).toBe(true);
      expect(skel.has(c), `skeleton has ${c}`).toBe(true);
    }
    // the phone button is rendered by ContactArtistButton (mocked above), so its classes are checked in its source
    expect(fs.readFileSync('src/components/ContactArtistButton.tsx', 'utf8')).toContain("contact-btn${iconOnly ? ' contact-icon-btn'");
    for (const c of ['contact-btn', 'contact-icon-btn']) expect(skel.has(c)).toBe(true);
  });
});
