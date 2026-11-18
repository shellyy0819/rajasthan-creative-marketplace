import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/LiveCatalog', () => ({ LiveCatalog: ({ kind }: any) => <div data-live-catalog={kind} /> }));
vi.mock('@/components/HostWorkshopButton', () => ({ HostWorkshopButton: ({ defaultOpen, initialPath, label }: any) => <button data-host-button data-open={String(!!defaultOpen)} data-initial={String(initialPath)}>{label ?? 'Host a workshop'}</button> }));
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
    expect(h).toContain('role="img"');                // the café illustration
    expect(h).toContain('>Host with us<');             // its chalkboard, since no workshop is hosted today
    expect(h).not.toContain('data-live-catalog');
    expect(h).not.toContain('Try a different city or filter');
  });
  it('is left out of the sitemap', async () => {
    expect(await urls()).not.toContain('https://craftofy.online/workshops');
  });
  it('?host=class opens the form on the class path; ?host=1 leaves the choice open; the empty state has just the one Host a workshop button', async () => {
    const cls = renderToStaticMarkup(await WorkshopsPage(sp({ host: 'class' })));
    expect(cls).toContain('data-open="true" data-initial="class"');
    expect(renderToStaticMarkup(await WorkshopsPage(sp({ host: '1' })))).toContain('data-open="true" data-initial="null"');
    expect(cls).not.toContain('>Teach an online class<');
    expect(cls.match(/data-host-button/g)).toHaveLength(1);
  });
  it('?host=1 opens the host form straight away; without it the form starts closed', async () => {
    expect(renderToStaticMarkup(await WorkshopsPage(sp({ host: '1' })))).toContain('data-open="true"');
    expect(renderToStaticMarkup(await WorkshopsPage(sp()))).toContain('data-open="false"');
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
  it('?host=1 still opens the host form (footer link), under the catalogue; without it there is no host button', async () => {
    const withLink = renderToStaticMarkup(await WorkshopsPage(sp({ host: '1' })));
    expect(withLink).toContain('data-live-catalog="workshops"');
    expect(withLink).toContain('data-open="true"');
  });
  it('?host=1 is noindex (a way into the form, not a page) and keeps /workshops as canonical', async () => {
    const m = await workshopsMeta(sp({ host: '1' }));
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBe('/workshops');
  });
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
