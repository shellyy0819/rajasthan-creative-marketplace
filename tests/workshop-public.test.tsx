import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => <button data-reserve>Reserve</button> }));
vi.mock('@/components/LiveCatalog', () => ({ LiveCatalog: ({ initialItems }: any) => <div data-live-catalog>{initialItems.map((w: any) => w.id).join(',')}</div> }));
vi.mock('@/components/HostWorkshopButton', () => ({ HostWorkshopButton: () => <button data-host-button>Host</button> }));
vi.mock('@/components/DataVersion', () => ({ DataVersionProvider: ({ children }: any) => <>{children}</> }));
vi.mock('@/lib/data-version', () => ({ getDataVersion: async () => 'v1' }));
vi.mock('@/lib/request-origin', () => ({ requestOrigin: async () => 'https://craftofy.online' }));
vi.mock('@/lib/catalog-wording', async orig => ({ ...(await orig<typeof import('@/lib/catalog-wording')>()), getCatalogWording: async () => ({ adjective: '', products: 'products', finds: 'finds', stats: { products: 0, makers: 0, cities: 0 } }) }));

import WorkshopPage, { generateMetadata as pageMeta } from '@/app/workshops/[slug]/page';
import WorkshopsPage, { generateMetadata as listMeta } from '@/app/workshops/page';
import sitemap from '@/app/sitemap';
import { WorkshopCard } from '@/components/WorkshopCard';
import { createWorkshop } from '@/lib/admin';
import { workshopSlug } from '@/lib/catalog-shared';
import { workshopJsonLd } from '@/lib/jsonld';
import type { Workshop } from '@/lib/types';
import { resetTestDb } from './helpers/testdb';
import { cityRef } from './helpers/cities';

const ymd = (d: number) => new Date(Date.now() + d * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
const yoga = {
  title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', date: '2026-01-05', host: 'Asha Rao', description: 'Gentle hatha yoga.', status: 'APPROVED',
  schedule: { days: ['mon', 'wed', 'fri'], time: '07:00', durationMin: 60 }, languages: ['Hindi', 'English'], level: 'beginner', experience: '8 years', certifications: 'RYT 500', freeTrial: true,
  whatsapp: '9989898999', instagram: '@asha.yoga', contactPhone: '9989898999', contactEmail: 'private@example.com',
  prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }, { label: 'Monthly', amountPaise: 150000, sessions: 12 }],
};
const event = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.', status: 'APPROVED' };
const sp = (o: Record<string, string> = {}) => ({ searchParams: Promise.resolve(o) });
const page = async (w: Workshop) => renderToStaticMarkup(await WorkshopPage({ params: Promise.resolve({ slug: workshopSlug(w) }) }));
const EMPTY = { products: [], workshops: [], orders: [], bookings: [], counters: {} } as never;

beforeEach(async () => { await resetTestDb(EMPTY); });

describe('cards', () => {
  it('an online class shows Online, platform, level, trial, a from-price and contact buttons, and no Reserve', async () => {
    const w = await createWorkshop(yoga);
    const h = renderToStaticMarkup(<WorkshopCard w={w} />);
    for (const s of ['Online', 'Zoom', 'Beginner', 'Free trial', 'From ₹500', 'href="https://wa.me/919989898999"', 'instagram.com/asha.yoga', 'Mon, Wed, Fri at 7:00 am, 60 min']) expect(h, s).toContain(s);
    expect(h).not.toContain('data-reserve');
    expect(h).not.toContain('seats left');
    expect(h).not.toContain('private@example.com');
  });
  it('an in-person event is unchanged: venue, seats left, price and Reserve', async () => {
    const h = renderToStaticMarkup(<WorkshopCard w={await createWorkshop(event)} />);
    for (const s of ['Studio 9', '8 seats left', '₹300', 'data-reserve']) expect(h, s).toContain(s);
  });
});

describe('detail page', () => {
  it('an online class lists every price plan, the schedule and the details, with no seats or Reserve', async () => {
    const h = await page(await createWorkshop(yoga));
    for (const s of ['Online on Zoom', 'Monthly: ₹1,500 (12 sessions)', 'Per session: ₹500 (1 session)', 'Mon, Wed, Fri at 7:00 am, 60 min', 'Hindi, English', 'Beginner', '8 years', 'RYT 500', 'Free trial', 'wa.me/919989898999']) expect(h, s).toContain(s);
    expect(h).not.toContain('data-reserve');
    expect(h).not.toContain('Seats left');
    expect(h).not.toContain('private@example.com');
    expect(h).not.toContain('This event has ended');
  });
  it('JSON-LD for an online class is an online event with a virtual location and offers, not a postal address', async () => {
    const j = JSON.stringify(workshopJsonLd(await createWorkshop(yoga)));
    expect(j).toContain('https://schema.org/OnlineEventAttendanceMode');
    expect(j).toContain('VirtualLocation');
    expect(j).toContain('"@type":"Offer"');
    expect(j).toContain('eventSchedule');
    expect(j).not.toContain('PostalAddress');
  });
  it('JSON-LD for a monthly class repeats every month on those weeks', async () => {
    const w = await createWorkshop({ ...yoga, schedule: { repeat: 'monthly', days: ['sat'], weeks: [1, 3], time: '07:00', durationMin: 60 } });
    const j = workshopJsonLd(w) as { eventSchedule: Record<string, unknown> };
    expect(j.eventSchedule).toMatchObject({ repeatFrequency: 'P1M', byMonthWeek: [1, 3], byDay: ['https://schema.org/Saturday'] });
    expect(renderToStaticMarkup(<WorkshopCard w={w} />)).toContain('1st and 3rd Sat of every month at 7:00 am, 60 min');
  });
  it('JSON-LD for an in-person event is as before', async () => {
    const j = JSON.stringify(workshopJsonLd(await createWorkshop(event)));
    expect(j).toContain('OfflineEventAttendanceMode');
    expect(j).toContain('PostalAddress');
  });
  it('an ended event keeps its page with a notice, no Reserve, and is noindex; a current one is indexable', async () => {
    const ended = await createWorkshop({ ...event, date: ymd(-3) });
    const h = await page(ended);
    expect(h).toContain('This event has ended');
    expect(h).not.toContain('data-reserve');
    expect((await pageMeta({ params: Promise.resolve({ slug: workshopSlug(ended) }) })).robots).toEqual({ index: false, follow: true });
    const current = await createWorkshop(event);
    expect((await pageMeta({ params: Promise.resolve({ slug: workshopSlug(current) }) })).robots).toBeUndefined();
  });
  it('a Draft has no page and is noindex', async () => {
    const d = await createWorkshop({ ...event, status: 'DRAFT' });
    expect((await pageMeta({ params: Promise.resolve({ slug: workshopSlug(d) }) })).robots).toEqual({ index: false });
    await expect(page(d)).rejects.toThrow();
  });
});

describe('lists and sitemap', () => {
  const urls = async () => (await sitemap()).map(e => e.url);
  it('the sitemap omits ended and draft listings and keeps an open-ended class', async () => {
    const ended = await createWorkshop({ ...event, date: ymd(-3) });
    const draft = await createWorkshop({ ...event, status: 'DRAFT' });
    const cls = await createWorkshop(yoga);
    const u = await urls();
    expect(u).not.toContain(`https://craftofy.online/workshops/${workshopSlug(ended)}`);
    expect(u).not.toContain(`https://craftofy.online/workshops/${workshopSlug(draft)}`);
    expect(u).toContain(`https://craftofy.online/workshops/${workshopSlug(cls)}`);
  });
  it('?mode=online lists only online listings', async () => {
    const online = await createWorkshop(yoga);
    await createWorkshop(event);
    const h = renderToStaticMarkup(await WorkshopsPage(sp({ mode: 'online' })));
    expect(h).toContain(`>${online.id}<`);
  });
  it('when every listing has ended /workshops is the empty state and noindex', async () => {
    await createWorkshop({ ...event, date: ymd(-3) });
    expect((await listMeta(sp())).robots).toEqual({ index: false, follow: true });
    expect(renderToStaticMarkup(await WorkshopsPage(sp()))).toMatch(/first workshops/i);
  });
  it('the page says what can be listed', async () => {
    await createWorkshop(event);
    expect(renderToStaticMarkup(await WorkshopsPage(sp()))).toContain('You can list workshops, meetups, pop-ups, flea markets and online classes.');
  });
});

describe('cover photo', () => {
  const photo = 'https://craftology.example/workshop-requests/public/a.jpg';
  it('the card shows the cover (first) photo instead of the plain tile, with a small label', async () => {
    const w = await createWorkshop({ ...yoga, images: [photo, 'https://craftology.example/workshop-requests/public/b.jpg'] });
    const h = renderToStaticMarkup(<WorkshopCard w={w} />);
    expect(h).toContain(`<img src="${photo}"`);
    expect(h).not.toContain('b.jpg');
    expect(h).toContain('has-photo');
    expect(h).toContain('workshop-card with-photo');
    expect(h).toMatch(/tile-chip[^>]*>Online/);
  });
  it('an in-person card shows its photo with the date as the label', async () => {
    const w = await createWorkshop({ ...event, images: [photo] });
    const h = renderToStaticMarkup(<WorkshopCard w={w} />);
    expect(h).toContain(`<img src="${photo}"`);
    expect(h).toMatch(/tile-chip[^>]*>1 Dec/);
  });
  it('with no photo the card keeps the plain tile', async () => {
    const h = renderToStaticMarkup(<WorkshopCard w={await createWorkshop(yoga)} />);
    expect(h).not.toContain('has-photo');
    expect(h).toContain('<b>Online</b>');
  });
  it('the listing page shows the cover photo, and the structured data lists it first', async () => {
    const w = await createWorkshop({ ...yoga, images: [photo] });
    expect(await page(w)).toContain(`<img src="${photo}"`);
    expect((workshopJsonLd(w) as { image: string[] }).image[0]).toBe(photo);
  });
});

describe('free trial length', () => {
  it('the card and the page say how many days the trial lasts', async () => {
    const w = await createWorkshop({ ...yoga, freeTrialDays: 7 });
    expect(renderToStaticMarkup(<WorkshopCard w={w} />)).toContain('Free trial · 7 days');
    expect(await page(w)).toContain('7-day free trial');
    const plain = await createWorkshop({ ...yoga });
    expect(renderToStaticMarkup(<WorkshopCard w={plain} />)).toContain('>Free trial<');
  });
});

describe('review fixes', () => {
  it('a website that is plain http still gets its button', async () => {
    const w = await createWorkshop({ ...yoga, whatsapp: undefined, instagram: undefined, website: 'http://studio.in' });
    expect(renderToStaticMarkup(<WorkshopCard w={w} />)).toContain('href="http://studio.in"');
  });
  it('an online listing that is not a class never prints "null"', async () => {
    const w = await createWorkshop({ ...yoga, kind: 'workshop', date: '2099-01-05' });
    const card = renderToStaticMarkup(<WorkshopCard w={w} />);
    expect(card).not.toContain('null');
    const meta = await pageMeta({ params: Promise.resolve({ slug: workshopSlug(w) }) });
    expect(JSON.stringify(meta)).not.toContain('null');
    expect(await page(w)).not.toContain('>null<');
  });
});
