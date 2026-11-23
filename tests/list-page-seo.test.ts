import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: () => null }));
vi.mock('@/components/LiveCatalog', () => ({ LiveCatalog: () => null }));
vi.mock('@/components/HostWorkshopButton', () => ({ HostWorkshopButton: () => null }));
vi.mock('@/components/DataVersion', () => ({ DataVersionProvider: ({ children }: any) => children }));
vi.mock('@/lib/data-version', () => ({ getDataVersion: async () => 'v1' }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://craftofy.online' }));
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: 'products', finds: 'finds', stats: { products: 3, makers: 2, cities: 2 } }) }));

import { generateMetadata as shopMeta } from '@/app/shop/page';
import { generateMetadata as workshopsMeta } from '@/app/workshops/page';
import { resetTestDb } from './helpers/testdb';

/**
 * Search engines must index /shop and /workshops once, at the plain address. Every filtered view (city, category, search ...) is the same
 * list sliced differently: it is left out of the index (noindex, links still followed) and its canonical stays the plain address, so no
 * filter combination turns into a page of its own. Tracking parameters change nothing, so they must never cost the page its place.
 */
const sp = (o: Record<string, string | string[]> = {}) => ({ searchParams: Promise.resolve(o) });
const NOINDEX = { index: false, follow: true };

const PAGES = [
  { name: '/shop', path: '/shop', meta: shopMeta, filters: { city: 'jaipur', category: 'Pottery', source: 'Handmade', q: 'blue' } },
  { name: '/workshops', path: '/workshops', meta: workshopsMeta, filters: { city: 'jaipur', type: 'FREE', mode: 'online', status: 'open', q: 'yoga' } },
] as const;

beforeEach(async () => { await resetTestDb(); });

describe.each(PAGES)('$name search metadata', ({ path, meta, filters }) => {
  it('the plain page is indexed, with itself as the canonical address', async () => {
    const m = await meta(sp());
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe(path);
  });

  it.each(Object.entries(filters))('?%s=%s is a filtered view: not indexed, canonical stays the plain address', async (key, value) => {
    const m = await meta(sp({ [key]: value }));
    expect(m.robots).toEqual(NOINDEX);
    expect(m.alternates?.canonical).toBe(path);
  });

  it('all filters at once are one more filtered view', async () => {
    const m = await meta(sp(filters));
    expect(m.robots).toEqual(NOINDEX);
    expect(m.alternates?.canonical).toBe(path);
  });

  it('the first value counts when a parameter is repeated', async () => {
    const [key] = Object.keys(filters);
    expect((await meta(sp({ [key]: ['x', 'y'] }))).robots).toEqual(NOINDEX);
  });

  it('tracking parameters (utm_*, fbclid, gclid, igsh) do not make it a filtered view', async () => {
    const m = await meta(sp({ utm_source: 'instagram', utm_medium: 'share', fbclid: 'abc', gclid: 'def', igsh: 'ghi' }));
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe(path);
  });

  it('empty, blank and "All India" values are not filters', async () => {
    const m = await meta(sp({ city: '', category: '   ', q: ' ' }));
    expect(m.robots).toBeUndefined();
    expect((await meta(sp({ city: 'All India' }))).robots).toBeUndefined();
  });

  it('an unknown parameter is not a filter, and the canonical folds it into the plain address', async () => {
    const m = await meta(sp({ foo: '1' }));
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe(path);
  });

  it('the Open Graph address stays the plain page too, never a filtered one', async () => {
    const m = await meta(sp({ city: 'jaipur' }));
    expect((m.openGraph as { url?: string }).url).toBe(path);
  });
});

describe('/workshops host links', () => {
  it.each<Record<string, string>>([{ host: '1' }, { host: 'class' }, { host: 'in-person' }, { type: 'online' }, { type: 'in-person' }])('%o opens the host form: not indexed, canonical stays /workshops', async q => {
    const m = await workshopsMeta(sp(q));
    expect(m.robots).toEqual(NOINDEX);
    expect(m.alternates?.canonical).toBe('/workshops');
  });
  it('an unknown host value is not a host link', async () => {
    expect((await workshopsMeta(sp({ host: 'nope' }))).robots).toBeUndefined();
  });
});
