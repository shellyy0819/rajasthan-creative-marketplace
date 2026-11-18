import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/LiveCatalog', () => ({ LiveCatalog: ({ kind }: any) => <div data-live-catalog={kind} /> }));
vi.mock('@/components/HostWorkshopButton', () => ({ HostWorkshopButton: () => <button data-host-button>Host a workshop</button> }));
vi.mock('@/components/DataVersion', () => ({ DataVersionProvider: ({ children }: any) => <>{children}</> }));
vi.mock('@/lib/data-version', () => ({ getDataVersion: async () => 'v1' }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://craftofy.online' }));
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: 'products', finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } }) }));

import WorkshopsPage, { generateMetadata as workshopsMeta } from '@/app/workshops/page';
import ShopPage, { generateMetadata as shopMeta } from '@/app/shop/page';
import sitemap from '@/app/sitemap';
import { resetTestDb } from './helpers/testdb';

const EMPTY = { products: [], workshops: [], orders: [], bookings: [], counters: {} } as never;
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });
const urls = async () => (await sitemap()).map(e => e.url);

describe('/workshops with no workshops at all', () => {
  beforeEach(async () => { await resetTestDb(EMPTY); });
  it('is not indexed (it would be a soft 404) but links are still followed', async () => {
    expect((await workshopsMeta(sp())).robots).toEqual({ index: false, follow: true });
  });
  it('shows a hosting block with the Host a workshop button instead of an empty list', async () => {
    const h = renderToStaticMarkup(await WorkshopsPage(sp()));
    expect(h).toContain('data-host-button');
    expect(h).toMatch(/first workshops/i);
    expect(h).not.toContain('data-live-catalog');
    expect(h).not.toContain('Try a different city or filter');
  });
  it('is left out of the sitemap', async () => {
    expect(await urls()).not.toContain('https://craftofy.online/workshops');
  });
  it('with a filter it keeps the normal catalogue (and noindex), not the hosting block', async () => {
    const h = renderToStaticMarkup(await WorkshopsPage(sp({ city: 'jaipur' })));
    expect(h).toContain('data-live-catalog="workshops"');
    expect(h).not.toContain('data-host-button');
    expect((await workshopsMeta(sp({ city: 'jaipur' }))).robots).toEqual({ index: false, follow: true });
  });
});

describe('/workshops with workshops', () => {
  beforeEach(async () => { await resetTestDb(); });
  it('is indexable, in the sitemap, and shows the normal catalogue', async () => {
    expect((await workshopsMeta(sp())).robots).toBeUndefined();
    expect(await urls()).toContain('https://craftofy.online/workshops');
    const h = renderToStaticMarkup(await WorkshopsPage(sp()));
    expect(h).toContain('data-live-catalog="workshops"');
    expect(h).not.toContain('data-host-button');
  });
});

describe('/shop with no products at all', () => {
  beforeEach(async () => { await resetTestDb(EMPTY); });
  it('is not indexed and is left out of the sitemap', async () => {
    expect((await shopMeta(sp())).robots).toEqual({ index: false, follow: true });
    expect(await urls()).not.toContain('https://craftofy.online/shop');
  });
});

describe('/shop with products', () => {
  beforeEach(async () => { await resetTestDb(); });
  it('is indexable and in the sitemap; a filter still makes it noindex', async () => {
    expect((await shopMeta(sp())).robots).toBeUndefined();
    expect(await urls()).toContain('https://craftofy.online/shop');
    expect((await shopMeta(sp({ category: 'Pottery' }))).robots).toEqual({ index: false, follow: true });
    expect(renderToStaticMarkup(await ShopPage(sp()))).toContain('data-live-catalog="products"');
  });
});
