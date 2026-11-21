import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { process.env.NEXTAUTH_SECRET = 'test-secret'; process.env.NEXT_PUBLIC_SITE_URL = 'https://craftofy.test'; });
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: any) => <a href={href} {...r}>{children}</a> }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); }, redirect: () => { throw new Error('REDIRECT'); }, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/components/WorkshopDetail', () => ({ WorkshopDetail: () => null }));
const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const gate = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('@/lib/admin-page', () => ({ requireStaffPage: gate.user, requireAdminPage: vi.fn() }));

import { POST as bookingRoute } from '@/app/api/bookings/route';
import BookingsPage from '@/app/dashboard/workshops/[id]/bookings/page';
import { WorkshopPreviewBar } from '@/components/WorkshopPreviewBar';
import { createWorkshop } from '@/lib/admin';
import { hostMail, notifyBooking, visitorMail } from '@/lib/booking-notify';
import { setMailSenderForTests, type Mail } from '@/lib/mailer';
import { listWorkshopBookings } from '@/lib/workshop-bookings';
import { cityRef } from './helpers/cities';
import { makeSeller, resetTestDb } from './helpers/testdb';

const event = { title: 'Lac Craft', type: 'PAID', pricePaise: 30000, cityRef: cityRef('Jodhpur'), venue: 'Studio 9', date: '2099-12-01', time: '16:30', seats: 8, host: 'Marwar Lac', description: 'Learn lac craft.', status: 'APPROVED' };
const post = (body: unknown) => new Request('http://x/api/bookings', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const asCustomer = (email: string) => authMock.mockResolvedValue({ user: { email, role: 'customer' } });
const mails: Mail[] = [];

beforeEach(async () => {
  authMock.mockReset(); authMock.mockResolvedValue(null); gate.user.mockReset();
  mails.length = 0; setMailSenderForTests(async m => { mails.push(m); });
  await resetTestDb();
});
afterEach(() => setMailSenderForTests(null));

describe('reserving a spot sends email', () => {
  it('tells the host (account email) who reserved, replies go to the visitor, and confirms to the visitor\'s signed-in address only', async () => {
    const host = await makeSeller('host@x.co', 'Host');
    const w = await createWorkshop({ ...event, hostId: host.id, contactEmail: 'private@x.co' });
    asCustomer('asha@x.co');
    const r = await bookingRoute(post({ workshopId: w.id, attendeeName: 'Asha Rao', email: 'asha.typed@x.co', quantity: 2 }));
    expect(r.status).toBe(201);
    expect(mails).toHaveLength(2);
    const toHost = mails.find(m => m.to === 'host@x.co')!;
    expect(toHost.subject).toContain('Asha Rao');
    expect(toHost.subject).toContain('2 seats');
    expect(toHost.text).toContain('Email: asha.typed@x.co');
    expect(toHost.text).toContain('Seats: 2');
    expect(toHost.text).toContain('₹600'); // 2 seats at 300
    expect(toHost.replyTo).toBe('asha.typed@x.co');
    const toVisitor = mails.find(m => m.to === 'asha@x.co')!;
    expect(toVisitor.subject).toContain('Lac Craft');
    expect(toVisitor.text).toContain('https://craftofy.test/workshops/');
    expect(toVisitor.replyTo).toBeUndefined();
    expect(JSON.stringify(mails)).not.toContain('private@x.co'); // the private contact never reaches the visitor
    expect(mails.some(m => m.to === 'asha.typed@x.co')).toBe(false); // the typed address is unverified: no mail to it
    expect(toVisitor.text).not.toContain('host@x.co');
  });

  it('uses the workshop\'s private contact email when no account is linked, and the team when there is neither', async () => {
    const a = await createWorkshop({ ...event, contactEmail: 'contact@x.co' });
    asCustomer('v@x.co');
    await bookingRoute(post({ workshopId: a.id, attendeeName: 'V', email: 'v@x.co', quantity: 1 }));
    expect(mails.map(m => m.to)).toContain('contact@x.co');
    mails.length = 0;
    const b = await createWorkshop({ ...event, title: 'No contact' });
    await bookingRoute(post({ workshopId: b.id, attendeeName: 'V', email: 'v@x.co', quantity: 1 }));
    const toTeam = mails.find(m => m.to !== 'v@x.co')!;
    expect(Array.isArray(toTeam.to)).toBe(true);
    expect(toTeam.subject).toContain('No contact');
  });

  it('a mail problem does not fail the booking, and nothing is sent when email is not set up', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = await createWorkshop({ ...event, contactEmail: 'contact@x.co' });
    asCustomer('v@x.co');
    setMailSenderForTests(async () => { throw new Error('smtp down'); });
    expect((await bookingRoute(post({ workshopId: w.id, attendeeName: 'V', email: 'v@x.co', quantity: 1 }))).status).toBe(201);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    expect((await listWorkshopBookings(w.id, { email: 'root@x.co', role: 'admin' }))!.bookings).toHaveLength(1);
  });

  it('a free event says Free and a failed booking (too many seats) sends nothing', async () => {
    const w = await createWorkshop({ ...event, type: 'FREE', pricePaise: 0, contactEmail: 'contact@x.co' });
    asCustomer('v@x.co');
    expect((await bookingRoute(post({ workshopId: w.id, attendeeName: 'V', email: 'v@x.co', quantity: 50 }))).status).toBe(409);
    expect(mails).toHaveLength(0);
    await bookingRoute(post({ workshopId: w.id, attendeeName: 'V', email: 'v@x.co', quantity: 1 }));
    expect(mails.find(m => m.to === 'contact@x.co')!.text).toContain('Total: Free');
  });

  it('the mail text keeps a visitor\'s name on one line (no injected lines)', async () => {
    const w = await createWorkshop({ ...event, contactEmail: 'contact@x.co' });
    const wk = { ...(await (await import('@/lib/catalog')).getWorkshopPreview(w.id))! };
    const b = { id: 'b', createdAt: '', userEmail: 'v@x.co', workshopId: w.id, title: w.title, attendeeName: 'Asha\nBcc: evil@x.co', email: 'v@x.co', quantity: 1, totalPaise: 30000, status: 'DEMO_BOOKING_CREATED', note: '' };
    expect(hostMail(b, wk).subject).not.toMatch(/\n/);
    expect(visitorMail(b, wk).subject).not.toMatch(/\n/);
    expect(await notifyBooking(b, 'v@x.co')).toEqual({ host: true, visitor: true });
  });
});

describe('listWorkshopBookings', () => {
  it('shows an admin any workshop and a seller only their own; others and bad ids are undefined', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati');
    await makeSeller('other@x.co', 'Other');
    const mine = await createWorkshop({ ...event, hostId: swati.id });
    const theirs = await createWorkshop({ ...event, title: 'Theirs', contactEmail: 'other@x.co' });
    asCustomer('v@x.co');
    await bookingRoute(post({ workshopId: mine.id, attendeeName: 'Asha', email: 'v@x.co', quantity: 1 }));
    await bookingRoute(post({ workshopId: theirs.id, attendeeName: 'Ravi', email: 'v@x.co', quantity: 3 }));
    const swatiView = { email: 'swati@x.co', role: 'seller' as const };
    expect((await listWorkshopBookings(mine.id, swatiView))!.bookings.map(b => b.attendeeName)).toEqual(['Asha']);
    expect(await listWorkshopBookings(theirs.id, swatiView)).toBeUndefined();
    const admin = { email: 'root@x.co', role: 'admin' as const };
    expect((await listWorkshopBookings(theirs.id, admin))!.bookings[0]).toMatchObject({ attendeeName: 'Ravi', quantity: 3, userEmail: 'v@x.co' });
    for (const bad of ['', 'p1', 'w999', 'w1; drop']) expect(await listWorkshopBookings(bad, admin)).toBeUndefined();
  });
});

describe('the Bookings page', () => {
  const page = async (id: string) => renderToStaticMarkup(await BookingsPage({ params: Promise.resolve({ id }) }));
  it('lists each reservation for the owner, with a mailto link, seats, total and status', async () => {
    const swati = await makeSeller('swati@x.co', 'Swati');
    const w = await createWorkshop({ ...event, hostId: swati.id });
    asCustomer('v@x.co');
    await bookingRoute(post({ workshopId: w.id, attendeeName: 'Asha Rao', email: 'asha.typed@x.co', quantity: 2 }));
    gate.user.mockResolvedValue({ email: 'swati@x.co', role: 'seller' });
    const h = await page(w.id);
    expect(h).toContain('Asha Rao');
    expect(h).toContain('href="mailto:asha.typed@x.co"');
    expect(h).toContain('Signed in as v@x.co');
    expect(h).toContain('₹600');
    expect(h).toContain('Reserved: pays the host directly');
    expect(h).toContain('1 reservation, 2 seats');
    expect(h).toContain('href="/dashboard/posts?tab=workshops"'); // a seller goes back to My workshops
  });
  it('says so when nobody has reserved, and an admin goes back to the workshop', async () => {
    const w = await createWorkshop(event);
    gate.user.mockResolvedValue({ email: 'root@x.co', role: 'admin' });
    const h = await page(w.id);
    expect(h).toContain('No reservations yet');
    expect(h).toContain(`href="/dashboard/workshops/${w.id}"`);
  });
  it('is a 404 for a seller\'s someone-else\'s workshop and for an unknown one', async () => {
    await makeSeller('swati@x.co', 'Swati');
    const w = await createWorkshop({ ...event, contactEmail: 'other@x.co' });
    gate.user.mockResolvedValue({ email: 'swati@x.co', role: 'seller' });
    await expect(page(w.id)).rejects.toThrow('NOT_FOUND');
    await expect(page('w999')).rejects.toThrow('NOT_FOUND');
  });
});

describe('the Bookings button', () => {
  const bar = (bookings?: number) => renderToStaticMarkup(<WorkshopPreviewBar id="w9" title="T" status="APPROVED" ended={false} bookings={bookings} />);
  it('appears on a preview for a workshop with seats, with the count, and not for a class', () => {
    expect(bar(3)).toContain('href="/dashboard/workshops/w9/bookings"');
    expect(bar(3)).toContain('Bookings (3)');
    expect(bar(0)).toContain('Bookings (0)');
    expect(bar(undefined)).not.toContain('/bookings');
  });
});
