// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

const getFairData = vi.hoisted(() => vi.fn());
const isFairOpen = vi.hoisted(() => vi.fn());
vi.mock('@/lib/fair-data', () => ({ getFairData }));
vi.mock('@/lib/fair-settings', () => ({ isFairOpen }));
vi.mock('@/components/fair/FairGame', () => ({ FairGame: ({ data }: { data: { source: string } }) => <div data-testid="game">{data.source}</div> }));

import FairPage, { metadata } from '@/app/fair/page';
import { SAMPLE_MAKERS, sampleFairData } from '@/lib/fair-sample';

afterEach(cleanup);
beforeEach(() => { isFairOpen.mockReset(); isFairOpen.mockResolvedValue(true); });
const ld = () => [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent!));

describe('/fair metadata', () => {
  it('has a title, description, canonical address and social cards', () => {
    expect(metadata.title).toMatch(/Craftofy Fair/);
    expect(String(metadata.description).length).toBeGreaterThan(60);
    expect(String(metadata.description).length).toBeLessThanOrEqual(160);
    expect(metadata.alternates?.canonical).toBe('/fair');
    expect(metadata.openGraph).toMatchObject({ url: '/fair', type: 'website' });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(metadata.robots).toBeUndefined(); // the page is meant to be found
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
  it('shows a closed notice, no game, no data fetch, and asks search engines to skip it', async () => {
    isFairOpen.mockResolvedValue(false);
    getFairData.mockClear();
    render(await FairPage());
    expect(screen.getByRole('heading', { level: 1, name: /closed for now/i })).toBeTruthy();
    expect(screen.queryByTestId('game')).toBeNull();
    expect(getFairData).not.toHaveBeenCalled();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    const back = screen.getByRole('link', { name: 'Shop handmade' });
    expect(back.getAttribute('href')).toBe('/shop');
    expect(back.className).toContain('primary');
  });
});
