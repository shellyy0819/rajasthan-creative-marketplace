// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/components/CityInput', () => ({ CityInput: () => <input name="cityRef" /> }));
vi.mock('@/components/ImageUploader', () => ({ ImageUploader: () => <div /> }));

import { GET as detailRoute } from '@/app/api/workshops/[id]/detail/route';
import { WorkshopPreviewBar } from '@/components/WorkshopPreviewBar';
import { createProduct, createWorkshop } from '@/lib/admin';
import { getWorkshopSellerDetail } from '@/lib/workshop-detail';
import { sellerProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { admin as adminActor } from './helpers/actors';
import { cityRef } from './helpers/cities';
import { getTestDb, makeSeller, resetTestDb } from './helpers/testdb';
import type { Workshop } from '@/lib/types';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const yoga = { title: 'Morning Flow', kind: 'class', mode: 'online', platform: 'Zoom', joinLink: 'https://zoom.us/j/1', date: '2099-01-05', host: 'Yoga with Swati', description: 'Gentle yoga.', status: 'APPROVED', whatsapp: '9989898999', schedule: { days: ['mon'], time: '07:00', durationMin: 60 }, contactEmail: 'swati@x.co' };
const product = { name: 'Lac Bangle', category: 'Accessories', cityRef: cityRef('Jodhpur'), pricePaise: 12000, description: 'Hand-set.', stock: 3, status: 'APPROVED' };

describe('seller detail for a workshop', () => {
  beforeEach(async () => { authMock.mockReset(); authMock.mockResolvedValue(null); await resetTestDb(); });

  it('finds the seller by the account email the listing was made with, and shows the profile, other workshops and products', async () => {
    const s = await makeSeller('swati@x.co', 'Yoga with Swati');
    await (await getTestDb()).update(sellerProfiles).set({ category: 'Wellness', bio: 'Mindful yoga.', instagram: 'swatime' }).where(eq(sellerProfiles.userId, s.id));
    const w = await createWorkshop(yoga);
    const other = await createWorkshop({ ...yoga, title: 'Evening Flow' });
    await createProduct({ ...product, sellerId: s.id }, adminActor);
    const d = await getWorkshopSellerDetail(w.id);
    expect(d.workshop).toMatchObject({ id: w.id, joinLink: 'https://zoom.us/j/1', contactEmail: 'swati@x.co' });
    expect(d.match).toBe('email');
    expect(d.seller).toMatchObject({ displayName: 'Yoga with Swati', accountEmail: 'swati@x.co', category: 'Wellness', bio: 'Mindful yoga.', instagram: 'swatime', roles: ['seller'] });
    expect(d.otherWorkshops.map(x => x.id)).toEqual([other.id]);
    expect(d.products.map(p => p.name)).toEqual(['Lac Bangle']);
  });
  it('falls back to the host name matching a seller profile, and says how it matched', async () => {
    await makeSeller('someone@x.co', 'Yoga with Swati');
    const w = await createWorkshop({ ...yoga, contactEmail: undefined });
    const d = await getWorkshopSellerDetail(w.id);
    expect(d.match).toBe('name');
    expect(d.seller?.accountEmail).toBe('someone@x.co');
  });
  it('with no matching seller account it still returns the workshop, with seller null', async () => {
    const w = await createWorkshop({ ...yoga, host: 'Nobody Studio', contactEmail: 'nobody@x.co' });
    const d = await getWorkshopSellerDetail(w.id);
    expect(d).toMatchObject({ seller: null, match: null, products: [], otherWorkshops: [] });
    expect(d.workshop.id).toBe(w.id);
  });
  it('an unknown workshop is a 404', async () => {
    await expect(getWorkshopSellerDetail('w999')).rejects.toMatchObject({ status: 404 });
  });
  it('the route is admin only', async () => {
    const w = await createWorkshop(yoga);
    expect((await detailRoute(new Request('http://x'), ctx(w.id))).status).toBe(401);
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer' } });
    expect((await detailRoute(new Request('http://x'), ctx(w.id))).status).toBe(403);
    authMock.mockResolvedValue({ user: { email: 'root@x.co', role: 'admin' } });
    const r = await detailRoute(new Request('http://x'), ctx(w.id));
    expect(r.status).toBe(200);
    expect((await r.json()).workshop.id).toBe(w.id);
  });
});

describe('the preview page\'s "Host and seller details" opens the seller detail', () => {
  const fetchMock = vi.fn();
  const w = { id: 'w1', title: 'Morning Flow', kind: 'class', mode: 'online', topicId: null, endsOn: null, platform: 'Zoom', schedule: { repeat: 'weekly', days: ['mon'], time: '07:00', durationMin: 60 }, languages: [], level: null, experience: null, certifications: null, freeTrial: false, freeTrialDays: null, whatsapp: null, instagram: null, website: null, images: [], prices: [], booked: 0, status: 'APPROVED', type: 'FREE', pricePaise: 0, city: null, cityId: null, citySlug: null, venue: null, seats: null, date: '2099-01-05', time: '07:00', host: 'Yoga with Swati', description: 'd', createdAt: '2026-11-18T14:05:00.000Z' } as unknown as Workshop;
  const detail = { workshop: { ...w, joinLink: 'https://zoom.us/j/1', contactEmail: 'swati@x.co', contactPhone: '+919989898999', prices: [{ label: 'Monthly', amountPaise: 150000, sessions: 12 }] }, match: 'email',
    seller: { userId: 'u1', slug: 'yoga-with-swati-u1', accountEmail: 'swati@x.co', displayName: 'Yoga with Swati', category: 'Wellness', bio: 'Mindful yoga.', instagram: 'swatime', roles: ['seller'] },
    otherWorkshops: [{ ...w, id: 'w2', title: 'Evening Flow' }], products: [{ id: 'p1', name: 'Lac Bangle', category: 'Accessories', pricePaise: 12000, status: 'APPROVED', stock: 3 }] };
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => detail }); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  const open = () => { render(<WorkshopPreviewBar id="w1" title="Morning Flow" status="APPROVED" ended={false} />); fireEvent.click(screen.getByRole('button', { name: /host and seller details/i })); };

  it('pressing the button opens a dialog with the workshop, the seller, their other workshops and their products', async () => {
    open();
    const dlg = await screen.findByRole('dialog', { name: /yoga with swati/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/workshops/w1/detail', expect.anything()));
    await within(dlg).findByText('Mindful yoga.');
    for (const t of ['Wellness', 'swati@x.co', 'Evening Flow', 'Lac Bangle', 'https://zoom.us/j/1', 'Monthly: ₹1,500 (12 sessions)', '+919989898999']) expect(dlg.textContent, t).toContain(t);
    expect(within(dlg).getByRole('heading', { name: /workshop/i })).toBeTruthy();
    expect(within(dlg).getByRole('heading', { name: /products/i })).toBeTruthy();
    const profile = within(dlg).getByRole('link', { name: /yoga with swati/i }) as HTMLAnchorElement;
    expect(profile.getAttribute('href')).toBe('/artists/yoga-with-swati-u1');
    expect(profile.target).toBe('_blank');
  });
  it('nothing is fetched until the button is pressed', () => {
    render(<WorkshopPreviewBar id="w1" title="Morning Flow" status="APPROVED" ended={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('Escape, Done and the close button close it', async () => {
    open();
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /host and seller details/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('says when no seller account matches, and shows a failure to load', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ...detail, seller: null, match: null, products: [], otherWorkshops: [] }) });
    open();
    expect((await screen.findByRole('dialog')).textContent).toMatch(/no seller account is linked/i);
    cleanup();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Boom' }) });
    open();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Boom/));
  });
});

describe('the preview bar', () => {
  afterEach(cleanup);
  it('goes back to the list, shows the status, links Edit to that listing, and links the public page only when there is one', () => {
    render(<WorkshopPreviewBar id="w7" title="Lac Craft" status="DRAFT" ended={false} />);
    expect(screen.getByRole('link', { name: /all workshops/i }).getAttribute('href')).toBe('/dashboard/workshops');
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe('/dashboard/workshops?edit=w7');
    expect(screen.queryByRole('link', { name: /public page/i })).toBeNull();
    cleanup();
    render(<WorkshopPreviewBar id="w7" title="Lac Craft" status="APPROVED" ended publicUrl="https://craftofy.online/workshops/lac-craft-w7" />);
    expect(screen.getByText('Published')).toBeTruthy(); expect(screen.getByText('Ended')).toBeTruthy();
    const pub = screen.getByRole('link', { name: /open the public page/i }) as HTMLAnchorElement;
    expect(pub.getAttribute('href')).toBe('https://craftofy.online/workshops/lac-craft-w7');
    expect(pub.target).toBe('_blank'); expect(pub.rel).toContain('noopener');
  });
});
