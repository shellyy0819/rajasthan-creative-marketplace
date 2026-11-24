// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

const getFairData = vi.hoisted(() => vi.fn());
const isFairOpen = vi.hoisted(() => vi.fn());
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: 'handmade', products: 'handmade products', finds: 'handmade finds', handmadeType: 'Handmade', stats: { products: 3, makers: 2, cities: 1 } }) })); // the real one reads the database
vi.mock('@/lib/fair-data', () => ({ getFairData }));
vi.mock('@/lib/fair-settings', () => ({ isFairOpen, getFairSettings: async () => ({ enabled: true, source: 'sample', mela: null }) }));
vi.mock('@/components/fair/FairGame', () => ({ FairGame: ({ data }: { data: { source: string } }) => <div data-testid="game">{data.source}</div> }));

import FairPage, { generateMetadata } from '@/app/fair/page';
import { SAMPLE_MAKERS, sampleFairData } from '@/lib/fair-sample';

afterEach(cleanup);
beforeEach(() => { isFairOpen.mockReset(); isFairOpen.mockResolvedValue(true); });
const ld = () => [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!));

describe('/fair metadata', () => {
  it('has a title, description, canonical address and social cards', async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toMatch(/Craftofy Fair/);
    expect(String(metadata.description).length).toBeGreaterThan(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe('/fair');
    expect(metadata.openGraph).toMatchObject({ url: '/fair', type: 'website' });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(metadata.robots).toEqual({ index: false, follow: true }); // never indexed: the walk-through has no text of its own to rank
  });
});

describe('/fair and the sitemap', () => {
  it('is not listed in the sitemap, since search engines are told to skip it (source contract)', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/app/sitemap.ts', 'utf8')).not.toContain('/fair');
  });
});

describe('/fair page', () => {
  it('renders breadcrumbs, the heading, the game and structured data', async () => {
    getFairData.mockResolvedValue(sampleFairData());
    render(await FairPage());
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Fair').getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { level: 1, name: 'Craftofy Fair' })).toBeTruthy();
    expect(screen.getByTestId('game').textContent).toBe('sample');
    const types = ld().map(d => d['@type']);
    expect(types).toEqual(expect.arrayContaining(['BreadcrumbList', 'WebPage']));
    expect(ld().find(d => d['@type'] === 'WebPage')).toMatchObject({ name: 'Craftofy Fair', inLanguage: 'en-IN' });
  });
  it('says plainly, above the game, that sample makers and products are made up', async () => {
    getFairData.mockResolvedValue(sampleFairData());
    render(await FairPage());
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(/this is a game, and a sample exhibition/i);
    expect(note.textContent).toMatch(/made up for the game/i);
    expect(note.textContent).toMatch(/not real sellers or listings/i);
    expect(note.compareDocumentPosition(screen.getByTestId('game')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(note).getByRole('link', { name: 'browse the shop' }).getAttribute('href')).toBe('/shop');
    expect(screen.getByText(/sample stalls and the made-up products/i)).toBeTruthy();
  });
  it('shows no sample notice when the stalls are real sellers', async () => {
    getFairData.mockResolvedValue({ ...sampleFairData(), source: 'real' });
    render(await FairPage());
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText(/everything on the counters right now/i)).toBeTruthy();
  });
  it('lists every stall and product as plain text for people and crawlers who skip the game', async () => {
    getFairData.mockResolvedValue(sampleFairData());
    render(await FairPage());
    const index = screen.getByRole('heading', { name: 'Stalls in the fair' }).closest('section')!;
    for (const m of SAMPLE_MAKERS) { expect(within(index).getByText(m.name)).toBeTruthy(); for (const i of m.items) expect(within(index).getByText(new RegExp(i.name))).toBeTruthy(); }
    expect(within(index).queryAllByRole('link')).toEqual([]); // sample makers have nothing to link to
  });
  it('links real makers and products to their pages', async () => {
    const maker = { ...SAMPLE_MAKERS[0], href: '/artists/rangili-1', items: [{ ...SAMPLE_MAKERS[0].items[0], href: '/products/dress-p1' }] };
    getFairData.mockResolvedValue({ source: 'real', stalls: [{ maker, label: 'Handmade crochet' }], makers: [maker] });
    render(await FairPage());
    const index = screen.getByRole('heading', { name: 'Stalls in the fair' }).closest('section')!;
    expect(within(index).getByRole('link', { name: 'Rangili Dhaga' }).getAttribute('href')).toBe('/artists/rangili-1');
    expect(within(index).getByRole('link', { name: 'Cotton Crochet Dress' }).getAttribute('href')).toBe('/products/dress-p1');
  });
  it('says so when no stall is open', async () => {
    getFairData.mockResolvedValue({ source: 'real', stalls: [], makers: [] });
    render(await FairPage());
    expect(screen.getByText('No stalls are open yet.')).toBeTruthy();
  });
});

describe('/fair while an admin has closed it', () => {
  it('shows a closed notice, no game and no data fetch', async () => {
    isFairOpen.mockResolvedValue(false);
    getFairData.mockClear();
    render(await FairPage());
    expect(screen.getByRole('heading', { level: 1, name: /closed for now/i })).toBeTruthy();
    expect(screen.queryByTestId('game')).toBeNull();
    expect(getFairData).not.toHaveBeenCalled();
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true }); // closed or open, never indexed
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Browse the shop' });
    expect(back.getAttribute('href')).toBe('/shop');
    expect(back.className).toContain('primary');
  });
});
