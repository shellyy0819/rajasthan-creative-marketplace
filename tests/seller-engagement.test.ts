import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createProduct, createWorkshop } from '@/lib/admin';
import { recordEvent, recordWorkshopEvent } from '@/lib/engagement';
import { artistSlug } from '@/lib/artist-slug';
import { activityFrom, filterSellers, sellerEngagement, windowFrom } from '@/lib/seller-engagement';
import { admin } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { makeSeller, resetTestDb } from './helpers/testdb';

const NOW = new Date('2026-10-21T12:00:00Z');
const DAY = '2026-10-20T10:00:00Z';
beforeEach(async () => { await resetTestDb(); });

const mkProduct = async (sellerId: string, name: string) => (await createProduct({ name, category: 'Pottery', cityRef: cityRef('Jaipur'), pricePaise: 1, description: 'D', stock: 1, status: 'APPROVED', sellerId }, admin)).id;
const online = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, status: 'APPROVED' };
const row = async (name: string, days = 30) => (await sellerEngagement({ days, now: NOW })).rows.find(r => r.name === name)!;

describe('windowFrom', () => {
  it('accepts only the offered windows and falls back to 30', () => {
    expect([windowFrom('7'), windowFrom('90'), windowFrom(['7', '30'])]).toEqual([7, 90, 7]);
    expect([windowFrom(undefined), windowFrom('5'), windowFrom('abc'), windowFrom('0')]).toEqual([30, 30, 30, 30]);
  });
});

describe('sellerEngagement()', () => {
  it('lists every active seller, with zeros when nobody has visited', async () => {
    await makeSeller('a@x.co', 'Quiet Maker');
    const r = await sellerEngagement({ now: NOW });
    expect(r.rows.find(s => s.name === 'Quiet Maker')).toMatchObject({ viewers: 0, openedContact: 0, contacted: 0 });
    expect(r.totals).toEqual({ viewers: 0, openedContact: 0, contacted: 0, sellersContacted: 0 });
  });

  it('counts looked, opened the contact options and really reached out separately, with the method', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    const p = await mkProduct(s.id, 'Star Pot');
    for (const a of ['h:1', 'h:2', 'h:3']) await recordEvent({ productId: p, type: 'view', actor: a }, new Date(DAY));
    for (const a of ['h:1', 'h:2']) await recordEvent({ productId: p, type: 'contact', actor: a }, new Date(DAY));
    await recordEvent({ productId: p, type: 'contact_call', actor: 'h:1' }, new Date(DAY));
    await recordEvent({ productId: p, type: 'contact_email', actor: 'h:1' }, new Date(DAY));
    await recordEvent({ productId: p, type: 'contact_instagram', actor: 'h:2' }, new Date(DAY));
    const r = await row('Star Maker');
    expect(r).toMatchObject({ viewers: 3, openedContact: 2, contacted: 2 }); // h:1 used two methods but is one visitor
    expect(r.byMethod).toMatchObject({ call: 1, email: 1, instagram: 1, whatsapp: 0, youtube: 0, website: 0, copy: 0 });
  });

  it('opening the contact options alone is not reaching out', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    const p = await mkProduct(s.id, 'Star Pot');
    await recordEvent({ productId: p, type: 'contact', actor: 'h:1' }, new Date(DAY));
    expect(await row('Star Maker')).toMatchObject({ openedContact: 1, contacted: 0 });
  });

  it('one visitor on two of the same seller’s products counts once for that seller, but once per seller overall', async () => {
    const a = await makeSeller('a@x.co', 'Maker A'); const b = await makeSeller('b@x.co', 'Maker B');
    const [a1, a2, b1] = [await mkProduct(a.id, 'A1'), await mkProduct(a.id, 'A2'), await mkProduct(b.id, 'B1')];
    for (const p of [a1, a2, b1]) await recordEvent({ productId: p, type: 'contact_call', actor: 'h:same' }, new Date(DAY));
    expect((await row('Maker A')).contacted).toBe(1);
    expect((await row('Maker B')).contacted).toBe(1);
    expect((await sellerEngagement({ now: NOW })).totals).toMatchObject({ contacted: 1, sellersContacted: 2 }); // not the sum of the rows
  });

  it('the same person on two days is two visitor-days', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    const p = await mkProduct(s.id, 'Star Pot');
    await recordEvent({ productId: p, type: 'view', actor: 'h:same' }, new Date('2026-10-19T10:00:00Z'));
    await recordEvent({ productId: p, type: 'view', actor: 'h:same' }, new Date(DAY));
    expect((await row('Star Maker')).viewers).toBe(2);
  });

  it('counts a host’s workshop contacts (WhatsApp, website) together with product contacts', async () => {
    const s = await makeSeller('swati@x.co', 'Swati Rao');
    const p = await mkProduct(s.id, 'Swati Mat');
    const w = await createWorkshop({ ...online, hostId: s.id });
    await recordEvent({ productId: p, type: 'contact_call', actor: 'h:1' }, new Date(DAY));
    await recordWorkshopEvent({ workshopId: w.id, type: 'contact_whatsapp', actor: 'h:2' }, new Date(DAY));
    await recordWorkshopEvent({ workshopId: w.id, type: 'view', actor: 'h:3' }, new Date(DAY));
    const r = await row('Swati Rao');
    expect(r).toMatchObject({ viewers: 1, contacted: 2 });
    expect(r.byMethod).toMatchObject({ call: 1, whatsapp: 1 });
  });

  it('only the chosen window counts: the first day is today minus (days - 1)', async () => {
    const s = await makeSeller('a@x.co', 'Star Maker');
    const p = await mkProduct(s.id, 'Star Pot');
    await recordEvent({ productId: p, type: 'view', actor: 'h:in' }, new Date('2026-10-15T10:00:00Z'));  // 6 days back: in a 7-day window (15..21)
    await recordEvent({ productId: p, type: 'view', actor: 'h:out' }, new Date('2026-10-14T10:00:00Z')); // 7 days back: out of 7, in 30
    const seven = await sellerEngagement({ days: 7, now: NOW });
    expect(seven.firstDay).toBe('2026-10-15');
    expect(seven.rows.find(x => x.name === 'Star Maker')!.viewers).toBe(1);
    expect((await row('Star Maker', 30)).viewers).toBe(2);
  });

  it('sorts by people who reached out, and leaves out deactivated sellers', async () => {
    const quiet = await makeSeller('q@x.co', 'Aaa Quiet'); const busy = await makeSeller('b@x.co', 'Zzz Busy');
    await mkProduct(quiet.id, 'Q1');
    const bp = await mkProduct(busy.id, 'B1');
    await recordEvent({ productId: bp, type: 'contact_copy', actor: 'h:1' }, new Date(DAY));
    const names = (await sellerEngagement({ now: NOW })).rows.map(r => r.name);
    expect(names.indexOf('Zzz Busy')).toBeLessThan(names.indexOf('Aaa Quiet'));
    const { getTestDb } = await import('./helpers/testdb');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await (await getTestDb()).update(users).set({ active: false }).where(eq(users.id, busy.id));
    expect((await sellerEngagement({ now: NOW })).rows.map(r => r.name)).not.toContain('Zzz Busy');
  });
});

describe('profile link data', () => {
  it('gives the same slug the site uses, and marks a seller with no published listing as having no public page', async () => {
    const live = await makeSeller('a@x.co', 'Star Maker'); const none = await makeSeller('b@x.co', 'No Listing');
    await mkProduct(live.id, 'Star Pot');
    expect(await row('Star Maker')).toMatchObject({ slug: artistSlug('Star Maker', live.id), listed: true });
    expect(await row('No Listing')).toMatchObject({ slug: artistSlug('No Listing', none.id), listed: false });
  });
  it('a host with only a published class has a public page', async () => {
    const h = await makeSeller('swati@x.co', 'Swati Rao');
    await createWorkshop({ ...online, hostId: h.id });
    expect((await row('Swati Rao')).listed).toBe(true);
  });
});

describe('filterSellers', () => {
  const mk = (name: string, viewers: number, openedContact: number, contacted: number) => ({ sellerId: name, name, slug: name, listed: true, viewers, openedContact, contacted, byMethod: { call: 0, whatsapp: 0, email: 0, instagram: 0, youtube: 0, website: 0, copy: 0 } });
  const rows = [mk('Meera Blue Pottery', 5, 1, 1), mk('Lakshmi Bandhani', 6, 0, 0), mk('Marwar Woodcraft', 0, 0, 0)];
  it('searches any part of the name, ignoring case and spaces around it', () => {
    expect(filterSellers(rows, { q: '  BLUE ' }).map(r => r.name)).toEqual(['Meera Blue Pottery']);
    expect(filterSellers(rows, { q: 'war' }).map(r => r.name)).toEqual(['Marwar Woodcraft']);
    expect(filterSellers(rows, { q: 'zzz' })).toEqual([]);
  });
  it('"visited" drops sellers nobody came to, "reached" keeps only those someone contacted', () => {
    expect(filterSellers(rows, { activity: 'visited' }).map(r => r.name)).toEqual(['Meera Blue Pottery', 'Lakshmi Bandhani']);
    expect(filterSellers(rows, { activity: 'reached' }).map(r => r.name)).toEqual(['Meera Blue Pottery']);
    expect(filterSellers(rows)).toHaveLength(3);
  });
  it('the two filters work together, and an unknown activity means all', () => {
    expect(filterSellers(rows, { q: 'bandh', activity: 'reached' })).toEqual([]);
    expect(filterSellers(rows, { q: 'l', activity: 'visited' }).map(r => r.name)).toEqual(['Meera Blue Pottery', 'Lakshmi Bandhani']);
    expect(activityFrom('bogus')).toBe('all');
    expect(activityFrom(['reached'])).toBe('reached');
  });
});
