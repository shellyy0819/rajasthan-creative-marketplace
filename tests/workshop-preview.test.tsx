import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: () => { throw new Error('REDIRECT'); }, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/components/ReserveButton', () => ({ ReserveButton: () => <button data-reserve>Reserve</button> }));
vi.mock('@/components/WorkshopDetail', () => ({ WorkshopDetail: () => null }));
const gate = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('@/lib/admin-page', () => ({ requireAdminPage: gate.fn, requireStaffPage: vi.fn() }));
vi.mock('@/lib/hosts', async orig => ({ ...(await orig<typeof import('@/lib/hosts')>()), hostConfig: () => ({ publicOrigin: 'https://craftofy.online' }) }));

import WorkshopPreviewPage from '@/app/dashboard/workshops/[id]/page';
import { createWorkshop } from '@/lib/admin';
import { getWorkshopPreview } from '@/lib/catalog';
import { workshopSlug } from '@/lib/catalog-shared';
import { cityRef } from './helpers/cities';
import { resetTestDb } from './helpers/testdb';

const EMPTY = { products: [], workshops: [], orders: [], bookings: [], counters: {} } as never;
const online = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', joinLink: 'https://zoom.us/j/secret', date: '2099-01-05', host: 'Asha Rao', description: 'Gentle hatha yoga.', status: 'DRAFT', schedule: { days: ['mon', 'wed'], time: '07:00', durationMin: 60 }, languages: ['English'], level: 'beginner', whatsapp: '9989898999', contactPhone: '9000000009', contactEmail: 'private@example.com', prices: [{ label: 'Per session', amountPaise: 50000, sessions: 1 }] };
const inPerson = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.', status: 'ARCHIVED', contactPhone: '9000000008', contactEmail: 'private2@example.com' };
const page = async (id: string) => renderToStaticMarkup(await WorkshopPreviewPage({ params: Promise.resolve({ id }) }));

beforeEach(async () => { gate.fn.mockReset(); gate.fn.mockResolvedValue(undefined); await resetTestDb(EMPTY); });

describe('getWorkshopPreview', () => {
  it('finds a listing in any status (Draft, Published, Archived), with its prices', async () => {
    for (const status of ['DRAFT', 'APPROVED', 'ARCHIVED']) {
      const w = await createWorkshop({ ...online, status, title: `Flow ${status}` });
      const p = await getWorkshopPreview(w.id);
      expect(p).toMatchObject({ id: w.id, title: `Flow ${status}`, status });
      expect(p!.prices).toHaveLength(1);
    }
  });
  it('is the public view: the host\'s private phone, email and join link are never in it', async () => {
    const w = await createWorkshop(online);
    const p = (await getWorkshopPreview(w.id))!;
    expect(JSON.stringify(p)).not.toMatch(/private@example\.com|9000000009|zoom\.us\/j\/secret/);
    expect(p).not.toHaveProperty('contactEmail'); expect(p).not.toHaveProperty('contactPhone'); expect(p).not.toHaveProperty('joinLink');
  });
  it('an unknown id, or one that is not a workshop id, is undefined', async () => {
    expect(await getWorkshopPreview('w999')).toBeUndefined();
    for (const bad of ['', 'p1', 'w1; drop', 'abc', 'w']) expect(await getWorkshopPreview(bad)).toBeUndefined();
  });
});

describe('the preview page (/dashboard/workshops/[id])', () => {
  it('shows the real online-class page for a Draft, which the public site would not show, with a notice that says so', async () => {
    const w = await createWorkshop(online);
    const h = await page(w.id);
    expect(h).toMatch(/<h1[^>]*>Morning Flow<\/h1>/);
    expect(h).toContain('cd-hero');                        // the same layout the public class page uses
    expect(h).toContain('YOUR INSTRUCTOR');
    expect(h).toMatch(/role="status"[^>]*>[\s\S]*Preview[\s\S]*Draft/);
    expect(h).toMatch(/Visitors cannot see this page until it is published/);
  });
  it('shows the real in-person workshop page for an Archived listing', async () => {
    const w = await createWorkshop(inPerson);
    const h = await page(w.id);
    expect(h).toMatch(/<h1[^>]*>Lac Craft<\/h1>/);
    expect(h).toContain('YOUR HOST');
    expect(h).toMatch(/Archived/);
  });
  it('the page content is switched off (inert) so nothing in the preview can be booked or contacted by accident', async () => {
    const w = await createWorkshop(inPerson);
    const h = await page(w.id);
    expect(h).toMatch(/<div class="ws-preview-page"[^>]*\binert=""/);
  });
  it('never shows private contact details, only what the public page shows', async () => {
    const w = await createWorkshop(online);
    const h = await page(w.id);
    expect(h).not.toMatch(/private@example\.com|9000000009|zoom\.us\/j\/secret/);
  });
  it('a published one links to its public page; a draft does not', async () => {
    const draft = await createWorkshop(online);
    expect(await page(draft.id)).not.toContain('Open the public page');
    const live = await createWorkshop({ ...online, status: 'APPROVED', title: 'Live Flow' });
    expect(await page(live.id)).toContain(`href="https://craftofy.online/workshops/${workshopSlug(live)}"`);
  });
  it('is admin only: the gate runs first and its refusal stops the page; an unknown id is a 404', async () => {
    const w = await createWorkshop(online);
    gate.fn.mockRejectedValue(new Error('NOT_FOUND'));
    await expect(page(w.id)).rejects.toThrow('NOT_FOUND');
    expect(gate.fn).toHaveBeenCalled();
    gate.fn.mockResolvedValue(undefined);
    await expect(page('w404')).rejects.toThrow('NOT_FOUND');
  });
});
